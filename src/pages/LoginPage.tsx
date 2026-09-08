import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import GoogleButton from "../components/GoogleButton";
import { signIn, signInWithGoogle, useCurrentUser } from "../lib/auth";
import { describeError } from "../lib/errors";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, refresh } = useCurrentUser();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed in already — let the index route decide where to land.
  if (user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn({ identifier, password });
      await refresh();
      navigate("/", { replace: true });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6" accent="sage">
        <h1 className="font-display text-2xl text-ink-900">Sign in</h1>

        <div className="mt-5">
          <GoogleButton
            action={signInWithGoogle}
            label="Continue with Google"
            busyLabel="Redirecting…"
            onError={setError}
            disabled={busy}
          />
        </div>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-card-200" />
          <span className="text-[11px] uppercase tracking-wide text-ink-500">
            or
          </span>
          <span className="h-px flex-1 bg-card-200" />
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-xs font-medium text-ink-700">
              Email or username
            </span>
            <input
              autoFocus
              required
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="mt-1 w-full rounded-md border border-card-200 bg-card-50 px-3 py-2 text-sm focus:border-sage-600 focus:outline-none"
            />
            {/* The first twelve accounts predate real emails and sign in by
                username; everyone since uses their address. One field, because
                which kind of account you have is not something to remember. */}
            <span className="mt-1 block text-[11px] text-ink-500">
              Accounts made before September 2026 sign in with a username.
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-700">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-card-200 bg-card-50 px-3 py-2 text-sm focus:border-sage-600 focus:outline-none"
            />
          </label>
          {error && (
            <div className="rounded-md bg-crimson-500/10 px-3 py-2 text-xs text-crimson-700">
              {error}
            </div>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <div className="mt-4 space-y-1 text-center text-xs text-ink-500">
          <p>
            New here?{" "}
            <Link to="/signup" className="text-sage-700 underline">
              Create an account
            </Link>
          </p>
          {/* Signing in with Google when you already have a password account
              makes a SECOND account with none of your history, and there is no
              way to merge them back. Say so where the mistake would be made. */}
          <p>
            Already play here? Sign in with your password first, then connect
            Google from your profile — signing in with Google straight away
            would start a new, empty account.
          </p>
        </div>
      </Card>
    </div>
  );
}
