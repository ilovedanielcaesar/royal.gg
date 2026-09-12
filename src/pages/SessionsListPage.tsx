import { useState } from "react";
import Band from "../components/Band";
import ErrorNote from "../components/ErrorNote";
import FeltButton from "../components/FeltButton";
import LoadingState from "../components/LoadingState";
import PageHeading from "../components/PageHeading";
import Sheet from "../components/Sheet";
import SessionsLedgerBand from "../features/sessions/SessionsLedgerBand";
import SessionsSummaryBand from "../features/sessions/SessionsSummaryBand";
import {
  useSessionsData,
  type SessionFilter,
} from "../features/sessions/useSessionsData";
import { useGroup } from "../lib/groupContext";

/**
 * The sessions ledger: one summary band and one list band inside a single
 * cream sheet. All data shaping lives in `useSessionsData`.
 */
export default function SessionsListPage() {
  const { path } = useGroup();
  const { data, error } = useSessionsData();
  const [filter, setFilter] = useState<SessionFilter>("all");

  return (
    <>
      <PageHeading
        title="Sessions"
        subtitle={data?.subtitle}
        actions={
          <FeltButton to={path("/sessions/new")}>+ New session</FeltButton>
        }
      />

      {error && !data ? (
        <Sheet>
          <Band>
            <ErrorNote>{error}</ErrorNote>
          </Band>
        </Sheet>
      ) : !data ? (
        <LoadingState tone="felt" full />
      ) : (
        <Sheet>
          {error && (
            <Band>
              <ErrorNote>{error}</ErrorNote>
            </Band>
          )}
          <SessionsSummaryBand
            summary={data.summary}
            activeFilter={filter}
            onFilter={setFilter}
          />
          <SessionsLedgerBand
            rows={data.rows}
            counts={data.summary}
            activeFilter={filter}
            onFilter={setFilter}
            sessionHref={(id) => path(`/sessions/${id}`)}
          />
        </Sheet>
      )}
    </>
  );
}
