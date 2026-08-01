"use client";

import { supabase } from "@/lib/supabase";

export type SessionStatus = "setup" | "live" | "tally" | "complete";

export interface DbSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: SessionStatus;
  house_fee_per_player: number;
  host_player_id: string | null;
  is_backfill: boolean;
}

export interface DbBuyIn {
  id: string;
  session_player_id: string;
  amount: number;
  created_at: string;
}

export interface DbSessionPlayer {
  id: string;
  session_id: string;
  player_id: string;
  display_name: string;
  chips_left: number | null;
  pays_house_fee: boolean;
  /** Joined in by loadSession. */
  buy_ins: DbBuyIn[];
  photo_url: string | null;
}

export interface LoadedSession {
  session: DbSession;
  players: DbSessionPlayer[];
}

export function sumBuyIns(p: DbSessionPlayer): number {
  return p.buy_ins.reduce((s, b) => s + b.amount, 0);
}

// ---------- Settings ----------

/** Last fee used, so it carries forward without being retyped. */
export async function getLastHouseFee(): Promise<number> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("last_house_fee")
    .eq("id", 1)
    .single();
  if (error) return 0;
  return (data as { last_house_fee: number } | null)?.last_house_fee ?? 0;
}

export async function setLastHouseFee(amount: number): Promise<void> {
  await supabase
    .from("app_settings")
    .update({ last_house_fee: Math.max(0, Math.round(amount)) })
    .eq("id", 1);
}

// ---------- Sessions ----------

export async function createSession(input: {
  playerIds: string[];
  displayNames: Record<string, string>;
  hostPlayerId: string | null;
  houseFeePerPlayer: number;
}): Promise<string> {
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      status: "live",
      house_fee_per_player: Math.max(0, Math.round(input.houseFeePerPlayer)),
      host_player_id: input.hostPlayerId,
    })
    .select()
    .single();
  if (error) throw error;

  const session = data as DbSession;

  const rows = input.playerIds.map((pid) => ({
    session_id: session.id,
    player_id: pid,
    display_name: input.displayNames[pid] ?? "",
    pays_house_fee: pid !== input.hostPlayerId,
  }));

  const { error: spError } = await supabase.from("session_players").insert(rows);
  if (spError) throw spError;

  await setLastHouseFee(input.houseFeePerPlayer);
  return session.id;
}

export async function loadSession(id: string): Promise<LoadedSession> {
  const { data: sData, error: sErr } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();
  if (sErr) throw sErr;

  const { data: pData, error: pErr } = await supabase
    .from("session_players")
    .select("*, players(photo_url), buy_ins(*)")
    .eq("session_id", id)
    .order("created_at");
  if (pErr) throw pErr;

  const players = ((pData ?? []) as unknown[]).map((raw) => {
    const row = raw as DbSessionPlayer & {
      players: { photo_url: string | null } | null;
      buy_ins: DbBuyIn[] | null;
    };
    return {
      id: row.id,
      session_id: row.session_id,
      player_id: row.player_id,
      display_name: row.display_name,
      chips_left: row.chips_left,
      pays_house_fee: row.pays_house_fee,
      photo_url: row.players?.photo_url ?? null,
      buy_ins: [...(row.buy_ins ?? [])].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      ),
    } as DbSessionPlayer;
  });

  return { session: sData as DbSession, players };
}

/** Most recent session that hasn't been completed yet. */
export async function findOpenSession(): Promise<DbSession | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .neq("status", "complete")
    .order("started_at", { ascending: false });
  if (error) return null;
  const rows = (data ?? []) as DbSession[];
  return rows[0] ?? null;
}

export async function listSessions(): Promise<DbSession[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbSession[];
}

export async function setSessionStatus(
  id: string,
  status: SessionStatus,
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "complete") patch.ended_at = new Date().toISOString();
  const { error } = await supabase.from("sessions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function updateSessionSettings(
  id: string,
  patch: { house_fee_per_player?: number; host_player_id?: string | null },
): Promise<void> {
  const { error } = await supabase.from("sessions").update(patch).eq("id", id);
  if (error) throw error;
  if (patch.house_fee_per_player !== undefined) {
    await setLastHouseFee(patch.house_fee_per_player);
  }
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Session players ----------

export async function addPlayerToSession(input: {
  sessionId: string;
  playerId: string;
  displayName: string;
  paysHouseFee: boolean;
}): Promise<void> {
  const { error } = await supabase.from("session_players").insert({
    session_id: input.sessionId,
    player_id: input.playerId,
    display_name: input.displayName,
    pays_house_fee: input.paysHouseFee,
  });
  if (error) throw error;
}

export async function removeSessionPlayer(sessionPlayerId: string): Promise<void> {
  const { error } = await supabase
    .from("session_players")
    .delete()
    .eq("id", sessionPlayerId);
  if (error) throw error;
}

export async function setChipsLeft(
  sessionPlayerId: string,
  chips: number | null,
): Promise<void> {
  const { error } = await supabase
    .from("session_players")
    .update({ chips_left: chips === null ? null : Math.max(0, Math.round(chips)) })
    .eq("id", sessionPlayerId);
  if (error) throw error;
}

export async function setPaysHouseFee(
  sessionPlayerId: string,
  pays: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("session_players")
    .update({ pays_house_fee: pays })
    .eq("id", sessionPlayerId);
  if (error) throw error;
}

// ---------- Buy-ins ----------

export async function addBuyIn(
  sessionPlayerId: string,
  amount: number,
): Promise<void> {
  const { error } = await supabase.from("buy_ins").insert({
    session_player_id: sessionPlayerId,
    amount: Math.round(amount),
  });
  if (error) throw error;
}

export async function removeBuyIn(buyInId: string): Promise<void> {
  const { error } = await supabase.from("buy_ins").delete().eq("id", buyInId);
  if (error) throw error;
}
