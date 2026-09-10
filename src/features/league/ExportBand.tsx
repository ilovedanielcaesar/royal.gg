import { useState } from "react";
import Band from "../../components/Band";
import Button from "../../components/Button";
import {
  toLeagueCsv,
  toLeagueJson,
  type LeagueExportInput,
} from "../../lib/exportLeague";
import type { Group } from "../../lib/groupContext";
import type { LeagueData } from "../../lib/useLeagueData";

type Props = {
  group: Group;
  league: LeagueData;
};

type ExportFormat = "csv" | "json";

export default function ExportBand({ group, league }: Props) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [feedback, setFeedback] = useState<string | null>(null);

  function download() {
    const input: LeagueExportInput = {
      group,
      data: league,
      exportedAt: new Date().toISOString(),
    };
    const isJson = format === "json";
    const content = isJson ? toLeagueJson(input) : toLeagueCsv(input);
    const blob = new Blob([content], {
      type: isJson ? "application/json" : "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${group.slug}-league-export.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setFeedback(
      `Exported ${format.toUpperCase()} · ${league.sessions.length} ${
        league.sessions.length === 1 ? "session" : "sessions"
      }`
    );
  }

  return (
    <Band
      title="Export league data"
      caption="All games, buy-ins, cash-outs, dates, and players, plus league metadata."
    >
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-card-100/45 px-[18px] py-4">
        <p className="max-w-[60ch] text-[13px] leading-5 text-ink-700">
          Download the complete league archive. Money stays in integer-cent fields so no precision is lost in a spreadsheet.
        </p>
        <div className="flex items-center gap-2.5">
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as ExportFormat)}
            className="min-h-[38px] rounded-lg border border-card-200 bg-card-50 px-3 text-xs font-semibold text-ink-900"
            aria-label="Export format"
          >
            <option value="csv">CSV format (.csv)</option>
            <option value="json">JSON format (.json)</option>
          </select>
          <Button type="button" variant="subtle" onClick={download}>
            Download export
          </Button>
        </div>
      </div>
      {feedback && (
        <p className="tabular mt-2 text-xs text-ink-500" role="status">
          {feedback}
        </p>
      )}
    </Band>
  );
}
