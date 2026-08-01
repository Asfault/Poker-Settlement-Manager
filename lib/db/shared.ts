"use client";

import { supabase } from "@/lib/supabase";
import type { Session } from "@/lib/types";
import { calculateSettlements, computeResults, totalBuyIn } from "@/lib/settlement";

/**
 * Sessions completed in the public (no-account) app get copied here so the
 * host can see how the app is being used in the wild.
 *
 * Kept in its own table — this data never touches the roster, the stats,
 * or the display.
 */

export interface SharedSessionRow {
  id: string;
  received_at: string;
  started_at: string | null;
  ended_at: string | null;
  player_count: number;
  total_pot: number;
  payload: SharedPayload;
  user_agent: string | null;
}

export interface SharedPayload {
  players: {
    name: string;
    totalBuyIn: number;
    chipsLeft: number;
    profitLoss: number;
    buyIns: { amount: number; at: number }[];
  }[];
  settlements: { from: string; to: string; amount: number }[];
  totalPot: number;
}

const SENT_KEY = "psm:shared:v1";

/** Session ids already sent, so a refresh doesn't duplicate them. */
function alreadySent(id: string): boolean {
  try {
    const raw = window.localStorage.getItem(SENT_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return list.includes(id);
  } catch {
    return false;
  }
}

function markSent(id: string): void {
  try {
    const raw = window.localStorage.getItem(SENT_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    window.localStorage.setItem(
      SENT_KEY,
      JSON.stringify([...list, id].slice(-50)),
    );
  } catch {
    // ignore
  }
}

/**
 * Fire-and-forget. Never blocks the UI and never surfaces an error —
 * a failed share should be invisible to whoever's using the app.
 */
export async function shareCompletedSession(session: Session): Promise<void> {
  if (typeof window === "undefined") return;
  if (alreadySent(session.id)) return;

  try {
    const results = computeResults(session.players);
    const settlements = calculateSettlements(results);
    const totalPot = results.reduce((s, r) => s + r.totalBuyIn, 0);

    const payload: SharedPayload = {
      players: session.players.map((p) => ({
        name: p.name,
        totalBuyIn: totalBuyIn(p),
        chipsLeft: p.chipsLeft ?? 0,
        profitLoss: (p.chipsLeft ?? 0) - totalBuyIn(p),
        buyIns: p.buyIns.map((b) => ({ amount: b.amount, at: b.at })),
      })),
      settlements,
      totalPot,
    };

    const { error } = await supabase.from("shared_sessions").insert({
      started_at: new Date(session.startedAt).toISOString(),
      ended_at: new Date().toISOString(),
      player_count: session.players.length,
      total_pot: totalPot,
      payload,
      user_agent: navigator.userAgent.slice(0, 300),
    });

    if (!error) markSent(session.id);
  } catch {
    // Silent by design.
  }
}

// ---------- Host side ----------

export async function listSharedSessions(): Promise<SharedSessionRow[]> {
  const { data, error } = await supabase
    .from("shared_sessions")
    .select("*")
    .order("received_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SharedSessionRow[];
}

export async function deleteSharedSession(id: string): Promise<void> {
  const { error } = await supabase
    .from("shared_sessions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
