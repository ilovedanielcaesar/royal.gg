import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useGroup } from "../lib/groupContext";
import Band from "./Band";
import FeltButton from "./FeltButton";
import LoadingState from "./LoadingState";
import PageHeading from "./PageHeading";
import Sheet from "./Sheet";

export default function RequireGroupMember({ children }: { children: ReactNode }) {
  const { loading, membership, notFound } = useGroup();
  if (loading) {
    return <LoadingState tone="felt" label="Dealing in…" full />;
  }
  if (notFound) {
    // A refusal is a page, not a notice. It was a bare Card with red text and
    // a sage link, which is the one shape this redesign is trying to remove:
    // no heading on the felt, and a link tinted the colour that means "won".
    return (
      <>
        <PageHeading
          title="No such table"
          subtitle="That group does not exist, or it is not one you can see."
          actions={
            <FeltButton variant="ghost" to="/groups">
              ← Your groups
            </FeltButton>
          }
        />
        <Sheet>
          <Band title="Check the link">
            <p className="mt-2 max-w-[60ch] text-sm text-ink-500">
              A group's address is its slug — the part after <code>/g/</code>.
              If someone sent you here, ask them for a join code instead: a
              link to a group you are not in looks exactly like this page.
            </p>
          </Band>
        </Sheet>
      </>
    );
  }
  if (!membership) return <Navigate to="/groups" replace />;
  return <>{children}</>;
}
