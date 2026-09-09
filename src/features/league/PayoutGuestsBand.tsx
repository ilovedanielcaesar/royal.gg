import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AddGuestForm from "../../components/AddGuestForm";
import Band from "../../components/Band";
import Button from "../../components/Button";
import GoldPill from "../../components/GoldPill";
import SuitBadge from "../../components/SuitBadge";
import { formatPlayedAt } from "../../lib/format";
import { formatSignedCents } from "../../lib/money";
import { moneyToneClass } from "../../lib/moneyTone";
import type { LeagueGuestRow, LeaguePageData } from "./useLeaguePageData";

type Props = {
  groupId: string;
  period: LeaguePageData["period"];
  periodSessionCount: number;
  guests: LeagueGuestRow[];
  isGroupAdmin: boolean;
  recordsHref: string;
  playerHref: (id: string) => string;
  reload: () => Promise<void>;
};

export default function PayoutGuestsBand({
  groupId,
  period,
  periodSessionCount,
  guests,
  isGroupAdmin,
  recordsHref,
  playerHref,
  reload,
}: Props) {
  const navigate = useNavigate();
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const opened = period.startAfter
    ? `Opened ${formatPlayedAt(period.startAfter)}`
    : "Open since the league began";

  return (
    <Band>
      <div className="grid gap-9 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-[23px] leading-[1.1]">
              Current payout period
            </h2>
            <p className="mt-1 text-xs text-ink-500">
              {opened} · {periodSessionCount} {periodSessionCount === 1 ? "session" : "sessions"} since · still open
            </p>
          </div>
          <p className="text-[13px] leading-6 text-ink-700">
            Balances and settlement history live on the dedicated payout page.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="subtle"
              onClick={() => navigate(recordsHref)}
            >
              Go to payout page →
            </Button>
            <span className="rounded-full bg-card-100 px-3 py-1 text-xs font-medium text-ink-700">
              {periodSessionCount} {periodSessionCount === 1 ? "session" : "sessions"} · Window open
            </span>
          </div>
          {periodSessionCount > 8 && (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-card-200 bg-card-100/40 px-4 py-3">
              <GoldPill>Reminder</GoldPill>
              <p className="text-xs leading-5 text-ink-700">
                Time to pay out: {periodSessionCount} sessions have run in the current payout period.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="font-display text-[23px] leading-[1.1]">
                Guests
              </h2>
              <p className="mt-1 text-xs text-ink-500">
                {guests.length} {guests.length === 1 ? "player" : "players"} not registered to the league
              </p>
            </div>
            {isGroupAdmin && (
              <Button
                type="button"
                variant="subtle"
                size="sm"
                onClick={() => {
                  setGuestError(null);
                  setShowGuestForm((shown) => !shown);
                }}
                aria-expanded={showGuestForm}
              >
                {showGuestForm ? "Cancel" : "+ Add guest"}
              </Button>
            )}
          </div>

          {guests.length === 0 ? (
            <p className="text-sm text-ink-500">No guests yet.</p>
          ) : (
            <div className="divide-y divide-card-100">
              {guests.map((guest) => {
                const name = guest.player.display_name ?? guest.player.name;
                return (
                  <Link
                    key={guest.playerId}
                    to={playerHref(guest.playerId)}
                    className="grid min-h-12 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2.5 py-2 transition hover:bg-card-100/60"
                  >
                    <span
                      className="flex h-9 w-7 items-center justify-center rounded-md bg-felt-900 ring-1 ring-felt-700"
                      aria-hidden="true"
                    >
                      <SuitBadge
                        suit="diamond"
                        size={13}
                        fill="var(--color-card-50)"
                        className="opacity-55"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{name}</span>
                        <span className="text-[10px] font-semibold tracking-[0.12em] text-ink-500">
                          GUEST
                        </span>
                      </span>
                      <span className="block text-[10.5px] text-ink-500">
                        {guest.sessionsPlayed} {guest.sessionsPlayed === 1 ? "night" : "nights"}
                      </span>
                    </span>
                    <span className={`tabular text-right font-display text-lg ${moneyToneClass(guest.totalNetCents)}`}>
                      {formatSignedCents(guest.totalNetCents)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          {showGuestForm && isGroupAdmin && (
            <AddGuestForm
              groupId={groupId}
              onAdded={() => {
                setShowGuestForm(false);
                void reload();
              }}
              onError={setGuestError}
            />
          )}
          {guestError && <p className="text-xs text-crimson-700">{guestError}</p>}
        </div>
      </div>
    </Band>
  );
}
