"use client";

import { supabase } from "@/lib/supabase";
import { SessionSummary, mapSessionRows } from "@/lib/db/stats";
import type { SeasonMeta } from "@/lib/stats/season";

/**
 * Public read-only stats, shared at pokeresh.com/<slug>.
 *
 * Viewers are anon and can't touch the tables — RLS blocks them. Everything
 * comes through the password-checked `shared_stats_payload` function added in
 * migration 008, which returns rows in the same shape loadCompletedSessions
 * produces so the page reuses the host-side maths verbatim.
 *
 * The slug is branding, not security. The password is the lock.
 */

/**
 * Reserved because each collides with a real route. A slug matching one of
 * these would either shadow a page or be shadowed by it — either way the
 * result is confusing, so the host UI refuses them.
 */
export const RESERVED_SLUGS = [
  "host",
  "display",
  "login",
  "api",
  "_next",
  "static",
  "public",
  "assets",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
];

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

/** Null when valid, otherwise a message to show the host. */
export function validateSlug(raw: string): string | null {
  const slug = raw.trim().toLowerCase();
  if (!slug) return "Pick a link name.";
  if (slug.length < 3) return "At least 3 characters.";
  if (slug.length > 40) return "Keep it under 40 characters.";
  if (!SLUG_PATTERN.test(slug)) {
    return "Lowercase letters, numbers and hyphens only, and it can't start or end with a hyphen.";
  }
  if (RESERVED_SLUGS.includes(slug)) return `"${slug}" is reserved.`;
  return null;
}

export function normaliseSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

const STORAGE_PREFIX = "pokeresh:shared:pw:";

export function savedSharePassword(slug: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + slug);
  } catch {
    return null;
  }
}

export function rememberSharePassword(slug: string, pw: string): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + slug, pw);
  } catch {
    // storage disabled — we just ask again next time
  }
}

export function forgetSharePassword(slug: string): void {
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + slug);
  } catch {
    // ignore
  }
}

/**
 * Whether this slug is a real shared page. Lets a mistyped URL 404 rather
 * than sit on a password prompt that could never be satisfied. Returns only a
 * boolean — it never reveals the slug or the password.
 */
export async function sharedSlugExists(slug: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("shared_stats_slug_exists", {
    p_slug: normaliseSlug(slug),
  });
  if (error) return false;
  return data === true;
}

export interface RosterEntry {
  playerId: string;
  name: string;
  photoUrl: string | null;
}

export interface SharedStatsResult {
  ok: boolean;
  sessions: SessionSummary[];
  /** Active players. Lets a season with no games yet still show a table. */
  roster: RosterEntry[];
  /** Epoch ms. Sessions before this belong to no season. */
  seasonsStartFrom: number | null;
  seasonMeta: SeasonMeta[];
  seasonExclusions: { seasonId: string; playerId: string }[];
}

export async function fetchSharedStats(
  slug: string,
  password: string,
): Promise<SharedStatsResult> {
  const { data, error } = await supabase.rpc("shared_stats_payload", {
    p_slug: normaliseSlug(slug),
    p_password: password,
  });
  if (error) throw error;

  const payload = data as {
    ok?: boolean;
    sessions?: unknown[];
    roster?: { player_id: string; name: string; photo_url: string | null }[];
    seasons_start_from?: string | null;
    season_meta?: {
      season_id: string;
      custom_name: string | null;
      note: string | null;
      no_winner: boolean;
    }[];
    season_exclusions?: { season_id: string; player_id: string }[];
  } | null;

  if (!payload || payload.ok !== true) {
    return {
      ok: false,
      sessions: [],
      roster: [],
      seasonsStartFrom: null,
      seasonMeta: [],
      seasonExclusions: [],
    };
  }

  return {
    ok: true,
    // Newest first, matching loadCompletedSessions — computePlayerStats
    // depends on that order to build recent form.
    sessions: mapSessionRows(payload.sessions ?? []).sort(
      (a, b) => b.startedAt - a.startedAt,
    ),
    roster: (payload.roster ?? []).map((r) => ({
      playerId: r.player_id,
      name: r.name,
      photoUrl: r.photo_url,
    })),
    seasonsStartFrom: payload.seasons_start_from
      ? new Date(payload.seasons_start_from).getTime()
      : null,
    seasonMeta: (payload.season_meta ?? []).map((m) => ({
      seasonId: m.season_id,
      customName: m.custom_name,
      note: m.note,
      noWinner: m.no_winner,
    })),
    seasonExclusions: (payload.season_exclusions ?? []).map((e) => ({
      seasonId: e.season_id,
      playerId: e.player_id,
    })),
  };
}

// ---------- Host-side settings ----------

export interface ShareSettings {
  slug: string | null;
  password: string | null;
}

export async function getShareSettings(): Promise<ShareSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("share_slug, share_password")
    .eq("id", 1)
    .single();
  if (error) return { slug: null, password: null };
  const row = data as {
    share_slug: string | null;
    share_password: string | null;
  } | null;
  return {
    slug: row?.share_slug ?? null,
    password: row?.share_password ?? null,
  };
}

export async function setShareSettings(
  slug: string | null,
  password: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .update({
      share_slug: slug && slug.trim() ? normaliseSlug(slug) : null,
      share_password: password && password.trim() ? password.trim() : null,
    })
    .eq("id", 1);
  if (error) throw error;
}
