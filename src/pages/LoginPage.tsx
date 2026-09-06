import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import { signIn, useCurrentUser } from "../lib/auth";
import { describeError } from "../lib/errors";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, refresh } = useCurrentUser();
  const [username, setUsername] = useState("");
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
      await signIn({ username, password });
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
        <p className="mt-1 text-sm text-ink-500">
          Username and password.
        </p>
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-xs font-medium text-ink-700">Username</span>
            <input
              autoFocus
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-md border border-card-200 bg-card-50 px-3 py-2 text-sm focus:border-sage-600 focus:outline-none"
            />
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
        <div className="mt-4 text-center text-xs text-ink-500">
          New here?{" "}
          <Link to="/signup" className="text-sage-700 underline">
            Create an account
          </Link>
        </div>
      </Card>
    </div>
  );
}
