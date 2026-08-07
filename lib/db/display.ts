"use client";

import { supabase } from "@/lib/supabase";

/**
 * The display isn't logged in, so everything goes through one
 * password-checked database function rather than direct table reads.
 */

export interface DisplayBuyIn {
  amount: number;
  at: string;
}

export interface DisplayLivePlayer {
  player_id: string;
  name: string;
  nickname: string | null;
  photo_url: string | null;
  character_url: string | null;
  total_buy_in: number;
  buy_ins: DisplayBuyIn[];
}

export interface DisplayLiveSession {
  id: string;
  started_at: string;
  status: string;
  house_fee_per_player: number;
  host_player_id: string | null;
  players: DisplayLivePlayer[];
}

export interface DisplayHistoryPlayer {
  player_id: string;
  name: string;
  nickname: string | null;
  photo_url: string | null;
  character_url: string | null;
  /** Archived players stay in the leaderboard but stop generating facts. */
  is_active?: boolean;
  total_buy_in: number;
  chips_left: number;
  buy_in_count: number;
  /** ISO timestamps — powers "when do they reload" style stats. */
  buy_in_times?: string[];
}

export interface DisplayHistorySession {
  id: string;
  started_at: string;
  ended_at: string | null;
  /**
   * Games entered as history rather than played through the app. They stamp
   * every buy-in at started_at and collapse them into one row, so anything
   * about reload timing or discipline has to exclude them.
   */
  is_backfill?: boolean;
  players: DisplayHistoryPlayer[];
}

export interface DisplayPayload {
  ok: boolean;
  live: DisplayLiveSession | null;
  history: DisplayHistorySession[];
  server_time: string;
}

const STORAGE_KEY = "pokeresh:display:pw";

export function savedPassword(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function rememberPassword(pw: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, pw);
  } catch {
    // storage disabled — the display just asks again next time
  }
}

export function forgetPassword(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function checkPassword(pw: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("display_password_ok", { pw });
  if (error) throw error;
  return data === true;
}

export async function fetchDisplayPayload(
  pw: string,
): Promise<DisplayPayload> {
  const { data, error } = await supabase.rpc("display_payload", { pw });
  if (error) throw error;
  const payload = data as DisplayPayload | null;
  if (!payload || payload.ok !== true) {
    return { ok: false, live: null, history: [], server_time: "" };
  }
  return {
    ok: true,
    live: payload.live ?? null,
    history: payload.history ?? [],
    server_time: payload.server_time,
  };
}

export interface DisplayLiveOnly {
  ok: boolean;
  live: DisplayLiveSession | null;
  /** Used to notice when a session finished and history needs refreshing. */
  completed_count: number;
  server_time: string;
}

/** Small and fast — safe to poll every second. */
export async function fetchLive(pw: string): Promise<DisplayLiveOnly> {
  const { data, error } = await supabase.rpc("display_live", { pw });
  if (error) throw error;
  const payload = data as DisplayLiveOnly | null;
  if (!payload || payload.ok !== true) {
    return { ok: false, live: null, completed_count: 0, server_time: "" };
  }
  return {
    ok: true,
    live: payload.live ?? null,
    completed_count: payload.completed_count ?? 0,
    server_time: payload.server_time,
  };
}

// ---------- Host-side settings ----------

export async function getDisplayPassword(): Promise<string | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("display_password")
    .eq("id", 1)
    .single();
  if (error) return null;
  return (data as { display_password: string | null } | null)?.display_password ?? null;
}

export async function setDisplayPassword(pw: string | null): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .update({ display_password: pw && pw.trim() ? pw.trim() : null })
    .eq("id", 1);
  if (error) throw error;
}
