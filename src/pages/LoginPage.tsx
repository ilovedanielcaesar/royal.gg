import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Band from "../components/Band";
import Button from "../components/Button";
import ErrorNote from "../components/ErrorNote";
import Field from "../components/Field";
import GoogleButton from "../components/GoogleButton";
import PageHeading from "../components/PageHeading";
import Sheet from "../components/Sheet";
import TextInput from "../components/TextInput";
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
    // The column is narrow but the anatomy is the page's: heading on the
    // felt, one sheet under it. A sign-in form does not want 1152px, and
    // nothing in the rule says the sheet has to be full width.
    <div className="mx-auto max-w-md">
      <PageHeading title="Sign in" subtitle="Back to the table." />

      <Sheet>
        <Band>
          <GoogleButton
            action={signInWithGoogle}
            label="Continue with Google"
            busyLabel="Redirecting…"
            onError={setError}
            disabled={busy}
          />

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-card-200" />
            <span className="text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase">
              or
            </span>
            <span className="h-px flex-1 bg-card-200" />
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            {/* The first twelve accounts predate real emails and sign in by
                username; everyone since uses their address. One field, because
                which kind of account you have is not something to remember. */}
            <Field
              label="Email or username"
              hint="Accounts made before September 2026 sign in with a username."
            >
              <TextInput
                autoFocus
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <TextInput
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Band>

        <Band>
          <p className="text-xs text-ink-500">
            New here?{" "}
            <Link
              to="/signup"
              className="font-medium underline hover:text-ink-900"
            >
              Create an account
            </Link>
          </p>
          {/* Signing in with Google when you already have a password account
              makes a SECOND account with none of your history, and there is no
              way to merge them back. Say so where the mistake would be made. */}
          <p className="mt-2 text-xs text-ink-500">
            Already play here? Sign in with your password first, then connect
            Google from your profile — signing in with Google straight away
            would start a new, empty account.
          </p>
        </Band>
      </Sheet>
    </div>
  );
}
