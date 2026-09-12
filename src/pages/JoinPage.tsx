import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Band from "../components/Band";
import Button from "../components/Button";
import ErrorNote from "../components/ErrorNote";
import FeltButton from "../components/FeltButton";
import Field from "../components/Field";
import PageHeading from "../components/PageHeading";
import Sheet from "../components/Sheet";
import TextInput from "../components/TextInput";
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
        <PageHeading
          title="Approval needed"
          subtitle={`Your request to join ${pending.groupName} is waiting.`}
          actions={
            <FeltButton variant="ghost" to="/groups">
              ← Your groups
            </FeltButton>
          }
        />
        <Sheet>
          <Band kicker="Pending" title="With the host">
            <p className="mt-2 text-sm text-ink-500">
              The host has to approve you before you can enter the table. You
              do not need to redeem the code again — once they approve, the
              group appears under your groups.
            </p>
          </Band>
        </Sheet>
      </div>
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void redeem(code);
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeading
        title="Join a group"
        subtitle="Enter the code shared by your group host."
        actions={<FeltButton variant="ghost" to="/groups">← Your groups</FeltButton>}
      />
      <Sheet>
        <Band>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="Join code">
              <TextInput
                autoFocus={!routeCode}
                autoComplete="off"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Joining…" : "Join group"}
            </Button>
          </form>
        </Band>
      </Sheet>
    </div>
  );
}
