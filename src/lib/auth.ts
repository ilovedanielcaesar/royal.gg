import { requireSupabase, syntheticEmail } from "./supabase";
export { useCurrentUser } from "./authContext";
export type { Player, Profile, CurrentUser } from "./authContext";

const USERNAME_RE = /^[a-z0-9_-]{3,20}$/i;

function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}

/**
 * Create an account. That is ALL this does.
 *
 * No players row, no group, no membership — an account belongs to nothing
 * until it joins or founds a group. The profiles row is written by the
 * on_auth_user_created trigger (migration 0009), which reads the username and
 * display name out of the user metadata passed below. Profile creation lives
 * in the database on purpose, so a future OAuth provider gets one with no
 * frontend change at all — see GROUPS.md §10b.
 */
export async function signUp(input: {
  username: string;
  displayName: string;
  password: string;
}): Promise<void> {
  const supabase = requireSupabase();
  const username = normalizeUsername(input.username);
  const displayName = input.displayName.trim();

  if (!USERNAME_RE.test(username)) {
    throw new Error(
      "Username must be 3–20 chars, letters/numbers/underscore/dash."
    );
  }
  if (displayName.length < 2) {
    throw new Error("Display name is too short.");
  }
  if (input.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const { data, error } = await supabase.auth.signUp({
    email: syntheticEmail(username),
    password: input.password,
    // Read by the on_auth_user_created trigger. A username taken by someone
    // else collides here first, on the unique auth email, so the trigger's
    // own collision fallback is only ever reached by an OAuth signup.
    options: { data: { username, display_name: displayName } },
  });
  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      throw new Error("That username is taken.");
    }
    throw error;
  }
  if (!data.user) {
    throw new Error(
      "Signup didn't return a user. Disable 'Confirm email' in Supabase Auth settings."
    );
  }
}

/**
 * Sign in with username + password.
 */
export async function signIn(input: {
  username: string;
  password: string;
}): Promise<void> {
  const supabase = requireSupabase();
  const username = normalizeUsername(input.username);
  if (!username) throw new Error("Enter your username.");
  const { error } = await supabase.auth.signInWithPassword({
    email: syntheticEmail(username),
    password: input.password,
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const supabase = requireSupabase();
  await supabase.auth.signOut();
}
