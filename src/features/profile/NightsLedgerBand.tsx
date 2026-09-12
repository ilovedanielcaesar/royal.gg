import { Link } from "react-router-dom";
import Band from "../../components/Band";
import { formatPlayedAt } from "../../lib/format";
import { formatCents, formatSignedCents } from "../../lib/money";
import { moneyToneClass } from "../../lib/moneyTone";
import type { ProfileLedgerRow } from "./profileData";

type Props = {
  rows: ProfileLedgerRow[];
  sessionHref: (sessionId: string) => string;
};

const GRID =
  "grid min-w-[680px] grid-cols-[minmax(160px,2fr)_120px_120px_120px_130px] items-center gap-3.5";

export default function NightsLedgerBand({ rows, sessionHref }: Props) {
  return (
    <Band
      title="Ledger records"
      kicker="Session breakdown"
      caption="Buy-ins and cash-outs shown as cash values"
    >
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink-500">No nights logged yet.</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <div className={`${GRID} px-2.5 py-2 text-[9.5px] font-semibold tracking-[0.09em] text-ink-500 uppercase`}>
            <span>Date</span>
            <span className="text-right">Buy-in cash</span>
            <span className="text-right">Cash-out</span>
            <span className="text-right">Net</span>
            <span className="text-right">Running total</span>
          </div>
          <div>
            {rows.map((row) => (
              <Link
                key={row.session.id}
                to={sessionHref(row.session.id)}
                className={`${GRID} min-h-12 border-t border-card-100 px-2.5 py-2 text-sm transition first:border-t-0 hover:bg-card-100/40`}
              >
                {/* The date IS the name of the night. "Night 7" was a
                    number this page invented — it is not on the session, it
                    is not what anyone calls the game, and it changes meaning
                    the moment a back-dated night is logged. */}
                <span className="font-medium">
                  {formatPlayedAt(row.session.played_at)}
                </span>
                <span className="tabular text-right">{formatCents(row.buyInCents)}</span>
                <span className="tabular text-right">{formatCents(row.cashOutCents)}</span>
                <span className={`tabular text-right font-semibold ${moneyToneClass(row.netCents)}`}>
                  {formatSignedCents(row.netCents)}
                </span>
                <span className={`tabular text-right font-semibold ${moneyToneClass(row.runningTotalCents)}`}>
                  {formatSignedCents(row.runningTotalCents)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Band>
  );
}
