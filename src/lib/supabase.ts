import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Username of the super-admin. Auto-active at signup; only this account can
 * record sessions or approve other accounts. Must match the value baked into
 * is_admin() in supabase/migrations/0005.
 */
export const ADMIN_USERNAME = (
  (import.meta.env.VITE_ADMIN_USERNAME as string | undefined) ?? "will"
).toLowerCase();

/**
 * Supabase Auth requires an email per user. We hide that from end users by
 * generating a fake email from their username — they never see this value.
 */
export const SYNTHETIC_EMAIL_DOMAIN = "royal.gg.local";

export function syntheticEmail(username: string): string {
  return `${username.toLowerCase()}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(url, anonKey, {
      auth: {
        // Disable cross-tab auth lock. Default uses navigator.locks which
        // causes "lock stolen" errors when the magic-link redirect opens a
        // new tab while the signup tab is still alive. We only ever use
        // one tab at a time in this app.
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
