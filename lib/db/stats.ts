"use client";

import { supabase } from "@/lib/supabase";

/**
 * All stats are built from POKER numbers only — chips left minus buy-ins.
 * House fees never enter these figures, so the leaderboard reflects cards
 * rather than who happened to host.
 */

export interface SessionSummary {
  id: string;
  startedAt: number;
  endedAt: number | null;
  isBackfill: boolean;
  houseFeePerPlayer: number;
  hostPlayerId: string | null;
  players: {
    playerId: string;
    name: string;
    photoUrl: string | null;
    totalBuyIn: number;
    chipsLeft: number;
    profitLoss: number;
    buyInCount: number;
  }[];
  pot: number;
  durationMs: number | null;
}

export interface PlayerStats {
  playerId: string;
  name: string;
  photoUrl: string | null;
  sessions: number;
  totalBuyIn: number;
  totalChips: number;
  totalProfitLoss: number;
  wins: number;
  losses: number;
  evens: number;
  winRate: number; // 0–1
  biggestWin: number;
  biggestLoss: number;
  avgProfitLoss: number;
  totalBuyInCount: number;
  lastPlayed: number | null;
  /** Most recent first: +1 win, -1 loss, 0 even. */
  recentForm: number[];
}

export interface GroupStats {
  sessions: number;
  totalMoney: number;
  biggestPot: number;
  avgPot: number;
  totalPlayerNights: number;
  firstSession: number | null;
  lastSession: number | null;
  avgDurationMs: number | null;
  /** Sunday = 0. Counts of sessions by weekday. */
  byWeekday: number[];
}

/** Every completed session, with players and buy-in totals resolved. */
export async function loadCompletedSessions(): Promise<SessionSummary[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "*, session_players(*, players(name, photo_url), buy_ins(amount))",
    )
    .eq("status", "complete")
    .order("started_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown[]).map((raw) => {
    const s = raw as {
      id: string;
      started_at: string;
      ended_at: string | null;
      is_backfill: boolean;
      house_fee_per_player: number;
      host_player_id: string | null;
      session_players: {
        player_id: string;
        display_name: string;
        chips_left: number | null;
        players: { name: string; photo_url: string | null } | null;
        buy_ins: { amount: number }[] | null;
      }[];
    };

    const players = (s.session_players ?? []).map((sp) => {
      const buyIns = sp.buy_ins ?? [];
      const totalBuyIn = buyIns.reduce((sum, b) => sum + b.amount, 0);
      const chipsLeft = sp.chips_left ?? 0;
      return {
        playerId: sp.player_id,
        // Prefer the current roster name so renames propagate through stats.
        name: sp.players?.name ?? sp.display_name,
        photoUrl: sp.players?.photo_url ?? null,
        totalBuyIn,
        chipsLeft,
        profitLoss: chipsLeft - totalBuyIn,
        buyInCount: buyIns.length,
      };
    });

    const startedAt = new Date(s.started_at).getTime();
    const endedAt = s.ended_at ? new Date(s.ended_at).getTime() : null;

    return {
      id: s.id,
      startedAt,
      endedAt,
      isBackfill: s.is_backfill,
      houseFeePerPlayer: s.house_fee_per_player,
      hostPlayerId: s.host_player_id,
      players,
      pot: players.reduce((sum, p) => sum + p.totalBuyIn, 0),
      durationMs: endedAt ? endedAt - startedAt : null,
    };
  });
}

export function computePlayerStats(sessions: SessionSummary[]): PlayerStats[] {
  const map = new Map<string, PlayerStats>();

  // Sessions arrive newest-first; walk oldest-first so recentForm builds up
  // in chronological order, then reverse at the end.
  const chronological = [...sessions].reverse();

  for (const s of chronological) {
    for (const p of s.players) {
      let e = map.get(p.playerId);
      if (!e) {
        e = {
          playerId: p.playerId,
          name: p.name,
          photoUrl: p.photoUrl,
          sessions: 0,
          totalBuyIn: 0,
          totalChips: 0,
          totalProfitLoss: 0,
          wins: 0,
          losses: 0,
          evens: 0,
          winRate: 0,
          biggestWin: 0,
          biggestLoss: 0,
          avgProfitLoss: 0,
          totalBuyInCount: 0,
          lastPlayed: null,
          recentForm: [],
        };
        map.set(p.playerId, e);
      }

      e.name = p.name;
      e.photoUrl = p.photoUrl;
      e.sessions += 1;
      e.totalBuyIn += p.totalBuyIn;
      e.totalChips += p.chipsLeft;
      e.totalProfitLoss += p.profitLoss;
      e.totalBuyInCount += p.buyInCount;

      if (p.profitLoss > 0) {
        e.wins += 1;
        e.recentForm.push(1);
      } else if (p.profitLoss < 0) {
        e.losses += 1;
        e.recentForm.push(-1);
      } else {
        e.evens += 1;
        e.recentForm.push(0);
      }

      if (p.profitLoss > e.biggestWin) e.biggestWin = p.profitLoss;
      if (p.profitLoss < e.biggestLoss) e.biggestLoss = p.profitLoss;
      if (e.lastPlayed === null || s.startedAt > e.lastPlayed) {
        e.lastPlayed = s.startedAt;
      }
    }
  }

  return [...map.values()]
    .map((e) => ({
      ...e,
      winRate: e.sessions > 0 ? e.wins / e.sessions : 0,
      avgProfitLoss: e.sessions > 0 ? e.totalProfitLoss / e.sessions : 0,
      recentForm: e.recentForm.slice(-10).reverse(),
    }))
    .sort((a, b) => b.totalProfitLoss - a.totalProfitLoss);
}

export function computeGroupStats(sessions: SessionSummary[]): GroupStats {
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  let totalMoney = 0;
  let biggestPot = 0;
  let playerNights = 0;
  let durationSum = 0;
  let durationCount = 0;

  for (const s of sessions) {
    totalMoney += s.pot;
    if (s.pot > biggestPot) biggestPot = s.pot;
    playerNights += s.players.length;
    byWeekday[new Date(s.startedAt).getDay()] += 1;
    if (s.durationMs !== null && s.durationMs > 0) {
      durationSum += s.durationMs;
      durationCount += 1;
    }
  }

  const times = sessions.map((s) => s.startedAt);

  return {
    sessions: sessions.length,
    totalMoney,
    biggestPot,
    avgPot: sessions.length > 0 ? Math.round(totalMoney / sessions.length) : 0,
    totalPlayerNights: playerNights,
    firstSession: times.length ? Math.min(...times) : null,
    lastSession: times.length ? Math.max(...times) : null,
    avgDurationMs: durationCount > 0 ? durationSum / durationCount : null,
    byWeekday,
  };
}

// ---------- Backfill ----------

/**
 * Insert a historical session in one go. Buy-ins are stored as a single
 * aggregate row per player, since old games have no per-buy-in timestamps.
 */
export async function createBackfillSession(input: {
  playedAt: Date;
  houseFeePerPlayer: number;
  hostPlayerId: string | null;
  players: {
    playerId: string;
    name: string;
    totalBuyIn: number;
    chipsLeft: number;
  }[];
}): Promise<string> {
  const iso = input.playedAt.toISOString();

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      started_at: iso,
      ended_at: iso,
      status: "complete",
      is_backfill: true,
      house_fee_per_player: Math.max(0, Math.round(input.houseFeePerPlayer)),
      host_player_id: input.hostPlayerId,
    })
    .select()
    .single();
  if (error) throw error;
  const sessionId = (data as { id: string }).id;

  const { data: spData, error: spErr } = await supabase
    .from("session_players")
    .insert(
      input.players.map((p) => ({
        session_id: sessionId,
        player_id: p.playerId,
        display_name: p.name,
        chips_left: Math.max(0, Math.round(p.chipsLeft)),
        pays_house_fee: p.playerId !== input.hostPlayerId,
      })),
    )
    .select();
  if (spErr) throw spErr;

  const created = (spData ?? []) as { id: string; player_id: string }[];
  const buyInRows = input.players
    .filter((p) => p.totalBuyIn > 0)
    .map((p) => {
      const sp = created.find((c) => c.player_id === p.playerId);
      return {
        session_player_id: sp?.id ?? "",
        amount: Math.round(p.totalBuyIn),
        created_at: iso,
      };
    })
    .filter((r) => r.session_player_id !== "");

  if (buyInRows.length > 0) {
    const { error: biErr } = await supabase.from("buy_ins").insert(buyInRows);
    if (biErr) throw biErr;
  }

  return sessionId;
}
