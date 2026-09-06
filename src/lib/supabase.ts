import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Supabase Auth requires an email per user. We hide that from end users by
 * generating a fake email from their username — they never see this value.
 */
const SYNTHETIC_EMAIL_DOMAIN = "royal.gg.local";

export function syntheticEmail(username: string): string {
  return `${username.toLowerCase()}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(url, anonKey, {
      auth: {
        // Disable cross-tab auth lock. The navigator.locks default throws
        // "lock stolen" when two tabs race on a token refresh; this app is
        // only ever driven from one tab at a time.
        lock: async (_name, _acquireTimeout, fn) => fn(),
      },
    })
  : null;

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
    );
  }
  return supabase;
}
