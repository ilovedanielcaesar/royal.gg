import { requireSupabase, syntheticEmail } from "./supabase";
export { useCurrentUser } from "./authContext";
export type { Player, Profile, CurrentUser } from "./authContext";

function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}

/**
 * Where a provider sends the browser back to. Must be an EXACT match for an
 * entry in Supabase's Auth -> URL Configuration -> Redirect URLs, or the
 * provider bounces to the Site URL instead and the sign-in appears to work
 * while landing in the wrong place. Built from window.location.origin so that
 * localhost, a Vercel preview and production each come back to themselves
 * without a build-time variable to forget.
 */
function redirectTo(path: string): string {
  return new URL(path, window.location.origin).toString();
}

/**
 * Is this an email address, or a legacy username?
 *
 * Accounts made before 2026-09-08 have no real email: signUp() invented
 * `<username>@royal.gg.local` so nobody had to type one. Those twelve people
 * still sign in by username. Everyone since types the address they signed up
 * with, and an OAuth account never reaches this code at all.
 *
 * "@" is the whole test, and it is the right one: it cannot appear in a
 * legacy username, because the old signup only ever accepted [a-z0-9_-].
 */
function isEmailAddress(identifier: string): boolean {
  return identifier.includes("@");
}

/**
 * Create an account with a real email address. That is ALL this does.
 *
 * No players row, no group, no membership — an account belongs to nothing
 * until it joins or founds a group. The profiles row is written by the
 * on_auth_user_created trigger (migration 0009), which reads display_name out
 * of the metadata below and derives a username from the email local part.
 * Profile creation lives in the database on purpose, so Google gets a profile
 * with no frontend change at all — see GROUPS.md §10b.
 *
 * NO USERNAME FIELD, deliberately. §10b settled that a username is a display
 * handle and not a login credential; asking for one at signup makes it look
 * like a credential and creates a second thing to forget. The trigger seeds it
 * from the email, and /profile is where it is changed.
 *
 * The email is real, unlike the synthetic `@royal.gg.local` addresses the
 * first twelve accounts carry. That is what makes a password recoverable at
 * all — reset is not built yet, but it is now possible, which it was not.
 */
export async function signUpWithEmail(input: {
  email: string;
  displayName: string;
  password: string;
}): Promise<void> {
  const supabase = requireSupabase();
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();

  if (!isEmailAddress(email) || /\s/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (email.endsWith("@royal.gg.local")) {
    // Not a real domain. Someone typing it is confused, and letting it through
    // would mint an account indistinguishable from the legacy twelve.
    throw new Error("That is not a real email address.");
  }
  if (displayName.length < 2) {
    throw new Error("Display name is too short.");
  }
  if (input.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { display_name: displayName } },
  });
  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      throw new Error(
        "There is already an account with that email. Sign in instead."
      );
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
 * Sign in with a password, by email OR by legacy username.
 *
 * One field on the form, because asking someone to know which KIND of account
 * they have is asking them to remember an implementation detail. See
 * isEmailAddress() for why "@" is a safe discriminator.
 */
export async function signIn(input: {
  identifier: string;
  password: string;
}): Promise<void> {
  const supabase = requireSupabase();
  const identifier = input.identifier.trim();
  if (!identifier) throw new Error("Enter your email or username.");

  const email = isEmailAddress(identifier)
    ? identifier.toLowerCase()
    : syntheticEmail(normalizeUsername(identifier));

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (error) {
    // Supabase says "Invalid login credentials" for both a wrong password and
    // an account that does not exist — correct, since distinguishing them
    // tells an attacker which emails are registered. Add the one thing a real
    // user might actually be getting wrong.
    if (/invalid login credentials/i.test(error.message)) {
      throw new Error(
        "That email or password is not right. If you signed up with Google, use the Google button instead."
      );
    }
    throw error;
  }
}

/**
 * Sign in with Google. Redirects away from the page, so nothing after this
 * resolves — the browser comes back to `/` with the session in the URL, and
 * the client picks it up via detectSessionInUrl.
 *
 * A brand-new Google account gets its profile from the same
 * on_auth_user_created trigger, which falls through to Google's `full_name`
 * for the display name. No frontend work, exactly as §10b predicted.
 */
export async function signInWithGoogle(): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectTo("/") },
  });
  if (error) throw error;
}

/**
 * Attach Google to the account already signed in.
 *
 * This is how the first twelve accounts reach Google WITHOUT losing anything.
 * Their email is `<username>@royal.gg.local`, which can never match a Google
 * address, so Supabase's automatic identity linking will never fire for them.
 * Signing in with Google instead would mint a SECOND auth user and a second
 * profile with no groups and no history — and there is no way back, because
 * their roster row already belongs to the first profile and 0018's guard
 * correctly refuses to move a card off an active member.
 *
 * So: sign in with your password once, link here, use Google forever after.
 * Requires "Manual linking" enabled in Supabase Auth settings.
 */
export async function linkGoogle(): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: { redirectTo: redirectTo("/profile") },
  });
  if (error) {
    if (/manual linking is disabled/i.test(error.message)) {
      throw new Error(
        "Account linking is turned off for this project. Enable Manual Linking in Supabase Auth settings."
      );
    }
    throw error;
  }
}

/** Which providers this account can sign in with. */
export async function listIdentities(): Promise<string[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) throw error;
  return (data?.identities ?? []).map((identity) => identity.provider);
}

export async function signOut(): Promise<void> {
  const supabase = requireSupabase();
  await supabase.auth.signOut();
}
