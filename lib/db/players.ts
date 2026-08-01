"use client";

import { supabase } from "@/lib/supabase";

export interface RosterPlayer {
  id: string;
  name: string;
  nickname: string | null;
  /** Square avatar — used everywhere in the app. */
  photo_url: string | null;
  /** Transparent caricature — the display table only. */
  character_url: string | null;
  is_active: boolean;
  created_at: string;
}

/** Name shown on screens — nickname when set, otherwise the real name. */
export function displayNameOf(p: RosterPlayer): string {
  return p.nickname?.trim() || p.name;
}

/**
 * Roster ordered by how often someone plays, then alphabetically.
 * Regulars float to the top so picking a lineup is mostly the first few taps.
 */
export async function listPlayers(
  includeInactive = false,
): Promise<RosterPlayer[]> {
  let query = supabase.from("players").select("*").order("name");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  const players = (data ?? []) as RosterPlayer[];

  const counts = await getGameCounts();
  return players.sort(
    (a, b) =>
      (counts[b.id] ?? 0) - (counts[a.id] ?? 0) || a.name.localeCompare(b.name),
  );
}

/** How many sessions each player has appeared in, keyed by player id. */
export async function getGameCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("session_players")
    .select("player_id");
  if (error) return {};
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { player_id: string }[]) {
    counts[row.player_id] = (counts[row.player_id] ?? 0) + 1;
  }
  return counts;
}

export async function createPlayer(input: {
  name: string;
  nickname?: string | null;
  photo_url?: string | null;
}): Promise<RosterPlayer> {
  const { data, error } = await supabase
    .from("players")
    .insert({
      name: input.name.trim(),
      nickname: input.nickname?.trim() || null,
      photo_url: input.photo_url ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as RosterPlayer;
}

export async function updatePlayer(
  id: string,
  patch: Partial<
    Pick<
      RosterPlayer,
      "name" | "nickname" | "photo_url" | "character_url" | "is_active"
    >
  >,
): Promise<RosterPlayer> {
  const clean: Record<string, unknown> = { ...patch };
  if (typeof clean.name === "string") clean.name = (clean.name as string).trim();
  if (typeof clean.nickname === "string") {
    clean.nickname = (clean.nickname as string).trim() || null;
  }
  const { data, error } = await supabase
    .from("players")
    .update(clean)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as RosterPlayer;
}

/**
 * Permanently remove a player. Fails if they've played in any session —
 * archive them instead so their history stays intact.
 */
export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Upload a square photo and return its public URL.
 * Honours the blob's own type so transparent PNGs stay PNG.
 */
export async function uploadPlayerPhoto(
  playerId: string,
  blob: Blob,
  kind: "avatar" | "character" = "avatar",
): Promise<string> {
  const type = blob.type || "image/jpeg";
  const ext = type.includes("png") ? "png" : "jpg";
  const path = `${playerId}-${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("player-photos")
    .upload(path, blob, { contentType: type, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("player-photos").getPublicUrl(path);
  return data.publicUrl;
}
