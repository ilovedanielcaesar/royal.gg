import Band from "../../components/Band";
import type { Player } from "../../lib/stats";
import GuestsPanel from "./GuestsPanel";
import PayoutPeriodPanel from "./PayoutPeriodPanel";
import type { LeagueGuestRow, PayoutPreviewRow } from "./useLeaguePageData";

type Props = {
  groupId: string;
  payoutPreview: PayoutPreviewRow[];
  distributorOptions: Player[];
  guests: LeagueGuestRow[];
  isGroupAdmin: boolean;
  recordsHref: string;
  playerHref: (id: string) => string;
  reload: () => Promise<void>;
};

/**
 * One band, two halves: money owed on the left, the people who are not
 * members on the right. Each half is its own component — they share a band
 * and nothing else, and both were long enough to want their own file.
 */
export default function PayoutGuestsBand({
  groupId,
  payoutPreview,
  distributorOptions,
  guests,
  isGroupAdmin,
  recordsHref,
  playerHref,
  reload,
}: Props) {
  return (
    <Band>
      <div className="grid gap-9 lg:grid-cols-2">
        <PayoutPeriodPanel
          groupId={groupId}
          rows={payoutPreview}
          distributorOptions={distributorOptions}
          isGroupAdmin={isGroupAdmin}
          recordsHref={recordsHref}
          reload={reload}
        />
        <GuestsPanel
          groupId={groupId}
          guests={guests}
          isGroupAdmin={isGroupAdmin}
          playerHref={playerHref}
          reload={reload}
        />
      </div>
    </Band>
  );
}
