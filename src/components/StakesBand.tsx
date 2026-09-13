import { useMemo, useState, type FormEvent } from "react";
import type { Group } from "../lib/groupContext";
import { formatCents, parseDollarsToCents } from "../lib/money";
import Band from "./Band";
import Button from "./Button";
import CurrencyInput from "./CurrencyInput";
import ErrorNote from "./ErrorNote";
import Field from "./Field";
import TextInput from "./TextInput";

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

/**
 * A band, not a card — it is one division of the settings sheet.
 *
 * The read-only half is the half nobody has opened: members reach
 * /g/:slug/settings because seeing the reconcile threshold is what explains
 * why a night got flagged, and RLS refuses their writes either way, so the
 * page hides the controls rather than the page.
 */
export default function StakesBand(props: Props) {
  if (!props.isGroupAdmin) {
    return <ReadOnlyStakesBand group={props.group} />;
  }

  return <EditableStakesBand group={props.group} save={props.save} />;
}

function ReadOnlyStakesBand({ group }: { group: Group }) {
  return (
    <Band
      kicker="Table"
      title="Stakes"
      caption="Set by an admin. These are what every night is priced against."
    >
      <div className="mt-4 space-y-4">
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
    </Band>
  );
}

function EditableStakesBand({
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
    <Band
      kicker="Table"
      title="Stakes"
      caption="What every night is priced against."
    >
      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <Field label="Stakes">
          <TextInput
            value={stakesLabel}
            onChange={(event) => {
              setStakesLabel(event.target.value);
              setValidationError(null);
            }}
            placeholder="$0.25 / $0.50"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Buy-in">
            <CurrencyInput
              value={defaultBuyIn}
              onChange={(value) => {
                setDefaultBuyIn(value);
                setValidationError(null);
              }}
            />
          </Field>

          <Field
            label="Reconcile threshold"
            hint={`A discrepancy up to ${displayedThreshold} is split among the winners automatically; anything over it flags the night for review.`}
          >
            <CurrencyInput
              value={reconcileThreshold}
              onChange={(value) => {
                setReconcileThreshold(value);
                setValidationError(null);
              }}
            />
          </Field>
        </div>

        {validationError && <ErrorNote>{validationError}</ErrorNote>}

        <Button type="submit" variant="secondary" disabled={saving || !hasChanges}>
          {saving ? "Saving…" : "Save stakes"}
        </Button>
      </form>
    </Band>
  );
}
