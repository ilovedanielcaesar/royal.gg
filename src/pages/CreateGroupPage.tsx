import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Band from "../components/Band";
import Button from "../components/Button";
import CurrencyInput from "../components/CurrencyInput";
import ErrorNote from "../components/ErrorNote";
import FeltButton from "../components/FeltButton";
import Field from "../components/Field";
import PageHeading from "../components/PageHeading";
import Sheet from "../components/Sheet";
import TextInput from "../components/TextInput";
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
    <div className="mx-auto max-w-2xl">
      <PageHeading
        title="Create a group"
        subtitle="Set the defaults for your table. You can change them later."
        actions={
          <FeltButton variant="ghost" to="/groups">
            ← Your groups
          </FeltButton>
        }
      />

      {error && (
        <ErrorNote tone="felt" className="mb-4">
          {error}
        </ErrorNote>
      )}

      <Sheet>
        <Band>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <Field label="Group name" hint={`URL: /g/${slug || "your-group"}`}>
              <TextInput
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Friday Night Poker"
              />
            </Field>

            <Field label="Stakes label" optional>
              <TextInput
                value={stakesLabel}
                onChange={(event) => setStakesLabel(event.target.value)}
                placeholder="$0.25 / $0.50"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Default buy-in">
                <CurrencyInput
                  required
                  value={defaultBuyIn}
                  onChange={setDefaultBuyIn}
                />
              </Field>
              <Field
                label="Reconcile threshold"
                hint="A discrepancy up to this is split among the winners automatically; anything over it flags the night for review."
              >
                <CurrencyInput
                  required
                  value={reconcileThreshold}
                  onChange={setReconcileThreshold}
                />
              </Field>
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create group"}
            </Button>
          </form>
        </Band>
      </Sheet>
    </div>
  );
}
