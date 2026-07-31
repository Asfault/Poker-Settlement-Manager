"use client";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** True only when both env vars are present. */
export const isSupabaseConfigured = Boolean(url && key);

if (!isSupabaseConfigured && typeof window !== "undefined") {
  console.warn(
    "[pokeresh] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
      "Host mode will be unavailable until these are set.",
  );
}

// createClient throws on an empty URL, which would crash the whole app at
// import time. Fall back to a syntactically valid placeholder so the app
// still renders and can show a helpful setup message instead.
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  key || "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
