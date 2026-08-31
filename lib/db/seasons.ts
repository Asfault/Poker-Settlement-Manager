"use client";

import { supabase } from "@/lib/supabase";
import type { SeasonMeta } from "@/lib/stats/season";

/**
 * Season settings. Host only.
 *
 * Seasons themselves aren't stored — they're derived from session dates
 * (see lib/stats/season.ts). The only things here are the ones that can't
 * be computed: where seasons begin, per-season annotations, and who's been
 * disqualified.
 */

export interface SeasonExclusion {
  seasonId: string;
  playerId: string;
}

export interface SeasonSettings {
  /** Epoch ms, or null when seasons haven't been switched on. */
  startFrom: number | null;
  meta: SeasonMeta[];
  exclusions: SeasonExclusion[];
}

export async function loadSeasonSettings(): Promise<SeasonSettings> {
  const [settings, meta, exclusions] = await Promise.all([
    supabase.from("app_settings").select("seasons_start_from").eq("id", 1).single(),
    supabase.from("season_meta").select("*"),
    supabase.from("season_exclusions").select("season_id, player_id"),
  ]);

  const raw = (settings.data as { seasons_start_from: string | null } | null)
    ?.seasons_start_from;

  return {
    startFrom: raw ? new Date(raw).getTime() : null,
    meta: ((meta.data ?? []) as {
      season_id: string;
      custom_name: string | null;
      note: string | null;
      no_winner: boolean;
    }[]).map((m) => ({
      seasonId: m.season_id,
      customName: m.custom_name,
      note: m.note,
      noWinner: m.no_winner,
    })),
    exclusions: ((exclusions.data ?? []) as {
      season_id: string;
      player_id: string;
    }[]).map((e) => ({ seasonId: e.season_id, playerId: e.player_id })),
  };
}

/** The date seasons begin at all. Everything before it is host-only. */
export async function setSeasonsStartFrom(date: string | null): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .update({ seasons_start_from: date })
    .eq("id", 1);
  if (error) throw error;
}

/**
 * Upsert one season's annotations. A row only exists once something has
 * been set on it, so most seasons have no row at all.
 */
export async function saveSeasonMeta(input: {
  seasonId: string;
  customName: string | null;
  note: string | null;
  noWinner: boolean;
}): Promise<void> {
  const { error } = await supabase.from("season_meta").upsert(
    {
      season_id: input.seasonId,
      custom_name: input.customName?.trim() || null,
      note: input.note?.trim() || null,
      no_winner: input.noWinner,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "season_id" },
  );
  if (error) throw error;
}

export async function addSeasonExclusion(
  seasonId: string,
  playerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("season_exclusions")
    .upsert(
      { season_id: seasonId, player_id: playerId },
      { onConflict: "season_id,player_id" },
    );
  if (error) throw error;
}

export async function removeSeasonExclusion(
  seasonId: string,
  playerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("season_exclusions")
    .delete()
    .eq("season_id", seasonId)
    .eq("player_id", playerId);
  if (error) throw error;
}
