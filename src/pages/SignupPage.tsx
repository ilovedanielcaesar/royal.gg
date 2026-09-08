import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import GoogleButton from "../components/GoogleButton";
import { signInWithGoogle, signUpWithEmail, useCurrentUser } from "../lib/auth";
import { describeError } from "../lib/errors";

export default function SignupPage() {
  const navigate = useNavigate();
  const { refresh } = useCurrentUser();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signUpWithEmail({ email, displayName, password });
      await refresh();
      // signUp() also signs the user in. The index route sends them to their
      // group, or to /groups when they have none yet — which a brand-new
      // account always does.
      navigate("/", { replace: true });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6" accent="gold">
        <h1 className="font-display text-2xl text-ink-900">
          Create an account
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Next you'll start a group or join one with a code.
        </p>

        <div className="mt-5">
          <GoogleButton
            action={signInWithGoogle}
            label="Sign up with Google"
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
              Display name
            </span>
            <input
              required
              autoFocus
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-md border border-card-200 bg-card-50 px-3 py-2 text-sm focus:border-sage-600 focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-ink-500">
              Shown on the leaderboard.
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-700">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-card-200 bg-card-50 px-3 py-2 text-sm focus:border-sage-600 focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-ink-500">
              Used to sign in. Nobody else sees it.
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-700">Password</span>
            <input
              type="password"
              required
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-card-200 bg-card-50 px-3 py-2 text-sm focus:border-sage-600 focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-ink-500">
              At least 6 characters.
            </span>
          </label>
          {error && (
            <div className="rounded-md bg-crimson-500/10 px-3 py-2 text-xs text-crimson-700">
              {error}
            </div>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Creating…" : "Create account"}
          </Button>
        </form>
        <div className="mt-4 text-center text-xs text-ink-500">
          Already have an account?{" "}
          <Link to="/login" className="text-sage-700 underline">
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
