import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import CurrencyInput from "../components/CurrencyInput";
import { useCurrentUser } from "../lib/auth";
import { describeError } from "../lib/errors";
import { generateJoinCode } from "../lib/joinCode";
import { requireSupabase } from "../lib/supabase";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dollarsToCents(value: string, label: string): number {
  const dollars = Number(value);
  const cents = Math.round(dollars * 100);
  if (
    value.trim() === "" ||
    !Number.isFinite(dollars) ||
    dollars < 0 ||
    !Number.isSafeInteger(cents)
  ) {
    throw new Error(`${label} must be a valid non-negative dollar amount.`);
  }
  return cents;
}

function isDuplicateSlug(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const details = error as Record<string, unknown>;
  if (details.code !== "23505") return false;
  return [details.message, details.details, details.hint]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLowerCase().includes("slug"));
}

export default function CreateGroupPage() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [stakesLabel, setStakesLabel] = useState("");
  const [defaultBuyIn, setDefaultBuyIn] = useState("40");
  const [reconcileThreshold, setReconcileThreshold] = useState("5");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slug = useMemo(() => slugify(name.trim()), [name]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;

    setSubmitting(true);
    setError(null);
    try {
      if (!slug) {
        throw new Error(
          "Enter a group name containing at least one letter or number."
        );
      }
      const defaultBuyInCents = dollarsToCents(
        defaultBuyIn,
        "Default buy-in"
      );
      if (defaultBuyInCents === 0) {
        throw new Error("Default buy-in must be greater than zero.");
      }
      const reconcileThresholdCents = dollarsToCents(
        reconcileThreshold,
        "Reconcile threshold"
      );
      const supabase = requireSupabase();
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .insert({
          name: name.trim(),
          slug,
          stakes_label: stakesLabel.trim() || null,
          default_buy_in_cents: defaultBuyInCents,
          reconcile_threshold_cents: reconcileThresholdCents,
          join_code: generateJoinCode(),
          created_by: user.id,
        })
        .select("id, slug")
        .single();
      if (groupError) throw groupError;

      const { error: memberError } = await supabase
        .from("group_members")
        .insert({
          group_id: group.id,
          profile_id: user.id,
          role: "admin",
          status: "active",
        });
      if (memberError) throw memberError;

      navigate(`/g/${group.slug}`);
    } catch (caught) {
      setError(
        isDuplicateSlug(caught)
          ? "That group URL is already taken. Try a more distinctive group name."
          : describeError(caught)
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-4xl text-card-50">Create a group</h1>
        <p className="mt-1 text-sm text-card-50/60">
          Set the defaults for your table. You can change them later.
        </p>
      </div>

      {error && (
        <Card accent="crimson">
          <p className="p-4 text-sm text-crimson-700">{error}</p>
        </Card>
      )}

      <Card watermarkSuit="diamond" accent="gold">
        <form className="space-y-5 p-6" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-xs font-medium text-ink-700">Group name</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Friday Night Poker"
              className="mt-1 w-full rounded-md bg-card-50 px-3 py-2 text-sm text-ink-900 ring-1 ring-card-200"
            />
            <span className="mt-1.5 block text-xs text-ink-500">
              URL: /g/{slug || "your-group"}
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-ink-700">
              Stakes label
              <span className="font-normal text-ink-500"> (optional)</span>
            </span>
            <input
              value={stakesLabel}
              onChange={(event) => setStakesLabel(event.target.value)}
              placeholder="$0.25 / $0.50"
              className="mt-1 w-full rounded-md bg-card-50 px-3 py-2 text-sm text-ink-900 ring-1 ring-card-200"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-ink-700">
                Default buy-in
              </span>
              <CurrencyInput
                required
                value={defaultBuyIn}
                onChange={setDefaultBuyIn}
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-700">
                Reconcile threshold
              </span>
              <CurrencyInput
                required
                value={reconcileThreshold}
                onChange={setReconcileThreshold}
                className="mt-1"
              />
            </label>
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create group"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
