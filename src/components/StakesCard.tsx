import { useMemo, useState, type FormEvent } from "react";
import type { Group } from "../lib/groupContext";
import { formatCents, parseDollarsToCents } from "../lib/money";
import Button from "./Button";
import Card from "./Card";
import CurrencyInput from "./CurrencyInput";

export type StakesUpdate = Pick<
  Group,
  "stakes_label" | "default_buy_in_cents" | "reconcile_threshold_cents"
>;

type Props = {
  group: Group;
  isGroupAdmin: boolean;
  save: (update: StakesUpdate) => Promise<void>;
};

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default function StakesCard(props: Props) {
  if (!props.isGroupAdmin) {
    return <ReadOnlyStakesCard group={props.group} />;
  }

  return <EditableStakesCard group={props.group} save={props.save} />;
}

function ReadOnlyStakesCard({ group }: { group: Group }) {
  return (
    <Card accent="gold">
      <div className="space-y-4 p-5">
        <h2 className="font-display text-2xl text-ink-900">Stakes</h2>

        <div>
          <p className="text-xs font-medium text-ink-700">Stakes</p>
          <p
            className={`mt-1 text-sm ${
              group.stakes_label === null ? "text-ink-500" : "text-ink-900"
            }`}
          >
            {group.stakes_label ?? "—"}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-ink-700">Buy-in</p>
            <p className="tabular mt-1 text-sm text-ink-900">
              {formatCents(group.default_buy_in_cents)}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-ink-700">
              Reconcile threshold
            </p>
            <p className="tabular mt-1 text-sm text-ink-900">
              {formatCents(group.reconcile_threshold_cents)}
            </p>
            <p className="mt-1.5 text-xs text-ink-500">
              A discrepancy up to {formatCents(group.reconcile_threshold_cents)}
              {" "}is split among the winners automatically; anything over it
              flags the night for review.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function EditableStakesCard({
  group,
  save,
}: Pick<Props, "group" | "save">) {
  const [stakesLabel, setStakesLabel] = useState(group.stakes_label ?? "");
  const [defaultBuyIn, setDefaultBuyIn] = useState(() =>
    centsToInput(group.default_buy_in_cents)
  );
  const [reconcileThreshold, setReconcileThreshold] = useState(() =>
    centsToInput(group.reconcile_threshold_cents)
  );
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const defaultBuyInCents = useMemo(
    () => parseDollarsToCents(defaultBuyIn),
    [defaultBuyIn]
  );
  const reconcileThresholdCents = useMemo(
    () => parseDollarsToCents(reconcileThreshold),
    [reconcileThreshold]
  );
  const normalizedStakesLabel = stakesLabel.trim() || null;
  const hasChanges =
    normalizedStakesLabel !== group.stakes_label ||
    defaultBuyInCents !== group.default_buy_in_cents ||
    reconcileThresholdCents !== group.reconcile_threshold_cents;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || !hasChanges) return;

    setValidationError(null);
    if (defaultBuyInCents === null || defaultBuyInCents <= 0) {
      setValidationError("A buy-in has to be more than $0.");
      return;
    }
    if (reconcileThresholdCents === null || reconcileThresholdCents < 0) {
      setValidationError("Enter a threshold of $0 or more.");
      return;
    }

    setSaving(true);
    await save({
      stakes_label: normalizedStakesLabel,
      default_buy_in_cents: defaultBuyInCents,
      reconcile_threshold_cents: reconcileThresholdCents,
    });
    setSaving(false);
  }

  const displayedThreshold =
    reconcileThresholdCents === null
      ? "the threshold"
      : formatCents(reconcileThresholdCents);

  return (
    <Card accent="gold">
      <form className="space-y-4 p-5" onSubmit={handleSubmit}>
        <h2 className="font-display text-2xl text-ink-900">Stakes</h2>

        <label className="block">
          <span className="text-xs font-medium text-ink-700">Stakes</span>
          <input
            value={stakesLabel}
            onChange={(event) => {
              setStakesLabel(event.target.value);
              setValidationError(null);
            }}
            placeholder="$0.25 / $0.50"
            className="mt-1 w-full rounded-md bg-card-50 px-3 py-2 text-sm text-ink-900 ring-1 ring-card-200"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-ink-700">Buy-in</span>
            <CurrencyInput
              value={defaultBuyIn}
              onChange={(value) => {
                setDefaultBuyIn(value);
                setValidationError(null);
              }}
              className="mt-1"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-ink-700">
              Reconcile threshold
            </span>
            <CurrencyInput
              value={reconcileThreshold}
              onChange={(value) => {
                setReconcileThreshold(value);
                setValidationError(null);
              }}
              className="mt-1"
            />
            <span className="mt-1.5 block text-xs text-ink-500">
              A discrepancy up to {displayedThreshold} is split among the
              winners automatically; anything over it flags the night for
              review.
            </span>
          </label>
        </div>

        {validationError && (
          <p className="rounded-md bg-crimson-500/10 px-3 py-2 text-xs text-crimson-700">
            {validationError}
          </p>
        )}

        <Button type="submit" variant="secondary" disabled={saving || !hasChanges}>
          {saving ? "Saving…" : "Save stakes"}
        </Button>
      </form>
    </Card>
  );
}
