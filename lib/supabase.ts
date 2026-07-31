"use client";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  // Surfaced at build/dev time so a missing env var fails loudly
  // instead of producing confusing runtime errors.
  console.warn(
    "[pokeresh] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
  );
}

export const supabase = createClient(url ?? "", key ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/** True when the env vars are present — used to show a helpful setup message. */
export const isSupabaseConfigured = Boolean(url && key);
