import type { Group } from "./groupContext";
import type { LeagueData } from "./useLeagueData";

export type LeagueExportInput = {
  group: Group;
  data: LeagueData;
  exportedAt: string;
};

const byId = <T extends { id: string }>(a: T, b: T) =>
  a.id.localeCompare(b.id);
const byPlayedAt = <T extends { id: string; played_at: string }>(a: T, b: T) =>
  a.played_at.localeCompare(b.played_at) || byId(a, b);

function publicGroup(group: Group) {
  return {
    id: group.id,
    name: group.name,
    slug: group.slug,
    stakes_label: group.stakes_label,
    default_buy_in_cents: group.default_buy_in_cents,
    reconcile_threshold_cents: group.reconcile_threshold_cents,
  };
}

/** Complete, stable JSON archive. All money remains integer cents. */
export function toLeagueJson({
  group,
  data,
  exportedAt,
}: LeagueExportInput): string {
  const sessions = [...data.sessions].sort(byPlayedAt).map((session) => ({
    ...session,
    buy_ins: data.buyIns
      .filter((buyIn) => buyIn.session_id === session.id)
      .sort(byId),
    cash_outs: data.cashOuts
      .filter((cashOut) => cashOut.session_id === session.id)
      .sort(byId),
  }));

  return JSON.stringify(
    {
      metadata: {
        schema_version: 1,
        exported_at: exportedAt,
        group: publicGroup(group),
      },
      players: [...data.players].sort(byId),
      sessions,
      payouts: [...data.payouts].sort((a, b) =>
        a.period_end_date.localeCompare(b.period_end_date) || byId(a, b)
      ),
    },
    null,
    2
  );
}

const COLUMNS = [
  "record_type", "exported_at", "group_id", "group_name", "group_slug",
  "stakes_label", "default_buy_in_cents", "reconcile_threshold_cents",
  "player_id", "player_name", "player_display_name", "player_profile_id",
  "player_is_guest", "player_status", "session_id", "played_at",
  "session_status", "session_buy_in_cents", "reconciled",
  "discrepancy_cents", "needs_review", "session_notes", "buy_in_id",
  "buy_in_amount_cents", "cash_out_id", "reported_cash_out_cents",
  "adjusted_cash_out_cents", "payout_id", "payout_period_end_date",
  "payout_distributor_player_id", "payout_notes", "created_at", "updated_at",
] as const;

type CsvRow = Partial<Record<(typeof COLUMNS)[number], string | number | boolean | null>>;

function csvCell(value: CsvRow[keyof CsvRow]): string {
  if (value == null) return "";
  if (typeof value !== "string") return String(value);
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Lossless flat archive with one typed row for every source record. */
export function toLeagueCsv({
  group,
  data,
  exportedAt,
}: LeagueExportInput): string {
  const base: CsvRow = {
    exported_at: exportedAt,
    group_id: group.id,
    group_name: group.name,
    group_slug: group.slug,
    stakes_label: group.stakes_label,
    default_buy_in_cents: group.default_buy_in_cents,
    reconcile_threshold_cents: group.reconcile_threshold_cents,
  };
  const playerById = new Map(data.players.map((player) => [player.id, player]));
  const sessionById = new Map(data.sessions.map((session) => [session.id, session]));
  const playerFields = (playerId: string): CsvRow => {
    const player = playerById.get(playerId);
    return {
      player_id: playerId,
      player_name: player?.name,
      player_display_name: player?.display_name,
      player_profile_id: player?.profile_id,
      player_is_guest: player?.is_guest,
      player_status: player?.status,
    };
  };
  const sessionFields = (sessionId: string): CsvRow => {
    const session = sessionById.get(sessionId);
    return {
      session_id: sessionId,
      played_at: session?.played_at,
      session_status: session?.status,
      session_buy_in_cents: session?.buy_in_cents,
      reconciled: session?.reconciled,
      discrepancy_cents: session?.discrepancy_cents,
      needs_review: session?.needs_review,
      session_notes: session?.notes,
    };
  };
  const rows: CsvRow[] = [];

  [...data.players].sort(byId).forEach((player) => rows.push({
    ...base, record_type: "player", ...playerFields(player.id),
    created_at: player.created_at, updated_at: player.updated_at,
  }));
  [...data.sessions].sort(byPlayedAt).forEach((session) => rows.push({
    ...base, record_type: "session", ...sessionFields(session.id),
    created_at: session.created_at, updated_at: session.updated_at,
  }));
  [...data.buyIns].sort(byId).forEach((buyIn) => rows.push({
    ...base, record_type: "buy_in", ...playerFields(buyIn.player_id),
    ...sessionFields(buyIn.session_id), buy_in_id: buyIn.id,
    buy_in_amount_cents: buyIn.amount_cents, created_at: buyIn.created_at,
  }));
  [...data.cashOuts].sort(byId).forEach((cashOut) => rows.push({
    ...base, record_type: "cash_out", ...playerFields(cashOut.player_id),
    ...sessionFields(cashOut.session_id), cash_out_id: cashOut.id,
    reported_cash_out_cents: cashOut.reported_amount_cents,
    adjusted_cash_out_cents: cashOut.adjusted_amount_cents,
    created_at: cashOut.created_at, updated_at: cashOut.updated_at,
  }));
  [...data.payouts].sort(byId).forEach((payout) => rows.push({
    ...base, record_type: "payout", payout_id: payout.id,
    payout_period_end_date: payout.period_end_date,
    payout_distributor_player_id: payout.distributor_player_id,
    payout_notes: payout.notes, created_at: payout.created_at,
  }));

  return [COLUMNS.join(","), ...rows.map((row) =>
    COLUMNS.map((column) => csvCell(row[column])).join(",")
  )].join("\n");
}
