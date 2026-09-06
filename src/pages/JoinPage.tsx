import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import { describeError } from "../lib/errors";
import { joinGroup, type JoinGroupResult } from "../lib/joinGroup";

export default function JoinPage() {
  const { code: routeCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [code, setCode] = useState(routeCode ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<JoinGroupResult | null>(null);
  const lastAutoCode = useRef<string | null>(null);
  const requestId = useRef(0);

  const redeem = useCallback(
    async (codeToRedeem: string) => {
      const currentRequest = ++requestId.current;
      setBusy(true);
      setError(null);
      // Router keeps this component mounted when only :code changes, so a
      // stale success card would otherwise survive into the next attempt and
      // hide its error.
      setPending(null);
      try {
        const result = await joinGroup(codeToRedeem);
        if (currentRequest !== requestId.current) return;
        if (result.status === "active") {
          navigate(`/g/${result.slug}`, { replace: true });
          return;
        }
        setPending(result);
      } catch (caught) {
        if (currentRequest === requestId.current) {
          setError(describeError(caught));
        }
      } finally {
        if (currentRequest === requestId.current) {
          setBusy(false);
        }
      }
    },
    [navigate]
  );

  useEffect(() => {
    if (!routeCode || lastAutoCode.current === routeCode) return;
    lastAutoCode.current = routeCode;
    void redeem(routeCode);
  }, [redeem, routeCode]);

  if (pending) {
    return (
      <div className="mx-auto max-w-md">
        <Card className="p-6" accent="gold" watermarkSuit="diamond">
          <h1 className="font-display text-2xl text-ink-900">
            Approval needed
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            Your request to join {pending.groupName} is waiting. The host has
            to approve you before you can enter the table.
          </p>
          <Link
            to="/groups"
            className="mt-5 inline-block text-sm text-sage-700 underline"
          >
            Back to your groups
          </Link>
        </Card>
      </div>
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void redeem(code);
  }

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6" accent="gold">
        <h1 className="font-display text-2xl text-ink-900">Join a group</h1>
        <p className="mt-1 text-sm text-ink-500">
          Enter the code shared by your group host.
        </p>
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-xs font-medium text-ink-700">Join code</span>
            <input
              autoFocus={!routeCode}
              autoComplete="off"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="mt-1 w-full rounded-md border border-card-200 bg-card-50 px-3 py-2 text-sm focus:border-sage-600 focus:outline-none"
            />
          </label>
          {error && (
            <div className="rounded-md bg-crimson-500/10 px-3 py-2 text-xs text-crimson-700">
              {error}
            </div>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Joining…" : "Join group"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
