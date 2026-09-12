import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Band from "../components/Band";
import Button from "../components/Button";
import ErrorNote from "../components/ErrorNote";
import Field from "../components/Field";
import GoogleButton from "../components/GoogleButton";
import PageHeading from "../components/PageHeading";
import Sheet from "../components/Sheet";
import TextInput from "../components/TextInput";
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
      <PageHeading
        title="Create an account"
        subtitle="Next you'll start a group or join one with a code."
      />

      <Sheet>
        <Band>
          <GoogleButton
            action={signInWithGoogle}
            label="Sign up with Google"
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
            <Field label="Display name" hint="Shown on the leaderboard.">
              <TextInput
                required
                autoFocus
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </Field>
            <Field label="Email" hint="Used to sign in. Nobody else sees it.">
              <TextInput
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password" hint="At least 6 characters.">
              <TextInput
                type="password"
                required
                autoComplete="new-password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Creating…" : "Create account"}
            </Button>
          </form>
        </Band>

        <Band>
          <p className="text-xs text-ink-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium underline hover:text-ink-900"
            >
              Sign in
            </Link>
          </p>
        </Band>
      </Sheet>
    </div>
  );
}
