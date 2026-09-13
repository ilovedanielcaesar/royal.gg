import { useEffect, useState } from "react";
import { describeError } from "../lib/errors";
import { linkGoogle, listIdentities } from "../lib/auth";
import ErrorNote from "./ErrorNote";
import LoadingState from "./LoadingState";
import GoogleButton from "./GoogleButton";

/**
 * Connect Google to the account you are already signed in as.
 *
 * This is the ONLY safe route to Google for an account made before September
 * 2026. Those twelve carry a synthetic `<username>@royal.gg.local` address,
 * which can never match a Google one, so Supabase's automatic linking will
 * never fire. Pressing "Continue with Google" on the sign-in page instead
 * mints a SECOND account — new profile, no groups, no history — and there is
 * no way back: the roster row still belongs to the first profile, and 0018's
 * guard rightly refuses to move a card off an active member.
 *
 * Unlinking is deliberately absent. Removing your only identity locks you out
 * of your own account, so it needs a guard of its own and is a separate piece
 * of work.
 */
export default function SignInMethodsCard() {
  const [providers, setProviders] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listIdentities()
      .then((found) => {
        if (!cancelled) setProviders(found);
      })
      .catch((caught) => {
        if (!cancelled) {
          setProviders([]);
          setError(describeError(caught));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasGoogle = providers?.includes("google") ?? false;

  return (
    <div>
      <h3 className="font-display text-lg text-ink-900">Sign-in methods</h3>
      <p className="mt-1 text-xs text-ink-500">
        How you get into this account. Adding one never replaces another.
      </p>

      {providers === null ? (
        <div className="mt-3">
          <LoadingState />
        </div>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-card-100 text-sm">
            {providers.includes("email") && (
              <li className="flex items-center justify-between py-2">
                <span className="text-ink-700">Email and password</span>
                <span className="text-xs text-sage-700">Connected</span>
              </li>
            )}
            <li className="flex items-center justify-between py-2">
              <span className="text-ink-700">Google</span>
              {hasGoogle ? (
                <span className="text-xs text-sage-700">Connected</span>
              ) : (
                <span className="text-xs text-ink-500">Not connected</span>
              )}
            </li>
          </ul>

          {!hasGoogle && (
            <div className="mt-4">
              <GoogleButton
                action={linkGoogle}
                label="Connect Google"
                busyLabel="Redirecting…"
                onError={setError}
              />
              <p className="mt-2 text-[11px] text-ink-500">
                Afterwards you can sign in with Google and land in this same
                account, keeping every game you have played.
              </p>
            </div>
          )}
        </>
      )}

      {error && (
        <ErrorNote className="mt-3">{error}</ErrorNote>
      )}
    </div>
  );
}
