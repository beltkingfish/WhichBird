"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MatchLevel } from "./taxonomy";

let client: SupabaseClient | null | undefined;

/** Browser client, or null when Supabase isn't configured (accounts are optional). */
export function browserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key) : null;
  return client;
}

/** Save a finished puzzle for the signed-in player. Silently does nothing when signed out. */
export async function syncResult(r: {
  mode: "daily" | "practice";
  dateKey: string;
  birdScientific: string;
  levels: MatchLevel[];
}) {
  const db = browserSupabase();
  if (!db) return;
  const { data } = await db.auth.getSession();
  const user = data.session?.user;
  if (!user) return;
  const { data: bird } = await db.from("birds").select("id").eq("scientific_name", r.birdScientific).maybeSingle();
  const { error } = await db.from("player_results").upsert({
    user_id: user.id,
    mode: r.mode,
    puzzle_date: r.dateKey,
    bird_id: bird?.id ?? null,
    guess_count: r.levels.length,
    guess_levels: r.levels,
  });
  if (error) console.warn("[lifer] could not save result:", error.message);
}
