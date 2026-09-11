import { useMemo, useState } from "react";
import Band from "../components/Band";
import ErrorNote from "../components/ErrorNote";
import FeltButton from "../components/FeltButton";
import LoadingState from "../components/LoadingState";
import MemberRow from "../components/MemberRow";
import PageHeading from "../components/PageHeading";
import Sheet from "../components/Sheet";
import { describeError } from "../lib/errors";
import { useGroup } from "../lib/groupContext";
import {
  memberName,
  type MemberSection,
  type MemberUpdate,
  type Membership,
} from "../lib/membership";
import { requireSupabase } from "../lib/supabase";
import useMembershipData from "../lib/useMembershipData";

const EMPTY_MESSAGE: Record<MemberSection, string> = {
  pending: "No requests waiting.",
  active: "No active members.",
  inactive: "Nobody has left or been removed.",
};

export default function GroupMembersPage() {
  const { group, isGroupAdmin, path } = useGroup();
  const { members, guests, error, refresh, setError } = useMembershipData(
    group?.id
  );
  // One object, not two useStates: which row is saving and what it is doing
  // have to move together, or the Link button reads "Linking…" while the row
  // is really being approved.
  const [busy, setBusy] = useState<{
    id: string;
    action: "link" | "member";
  } | null>(null);

  const sections = useMemo(() => {
    const rows = members ?? [];
    const byName = (a: Membership, b: Membership) =>
      memberName(a).localeCompare(memberName(b));
    return {
      pending: rows
        .filter((m) => m.status === "pending")
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      // Admins first, then alphabetical.
      active: rows
        .filter((m) => m.status === "active")
        .sort((a, b) =>
          a.role === b.role ? byName(a, b) : a.role === "admin" ? -1 : 1
        ),
      inactive: rows
        .filter(
          (m) =>
            m.status === "removed" ||
            m.status === "rejected" ||
            m.status === "left"
        )
        .sort(byName),
    };
  }, [members]);

  // Only ACTIVE admins count. A pending admin is not cover: you could demote
  // yourself while your replacement waits on an approval only you can grant.
  const activeAdminCount = sections.active.filter(
    (m) => m.role === "admin"
  ).length;

  async function updateMember(id: string, update: MemberUpdate) {
    if (!group || !isGroupAdmin || busy) return;
    setBusy({ id, action: "member" });
    setError(null);
    try {
      const { error } = await requireSupabase()
        .from("group_members")
        .update(update)
        .eq("id", id)
        .eq("group_id", group.id);
      if (error) throw error;
      await refresh();
    } catch (caught) {
      // Includes the last-admin trigger, whose message is written to be read.
      setError(describeError(caught));
    } finally {
      setBusy(null);
    }
  }

  async function linkGuest(member: Membership, guestId: string) {
    const profileId = member.profiles?.id;
    if (!group || !isGroupAdmin || busy || !profileId) return;
    setBusy({ id: member.id, action: "link" });
    setError(null);
    try {
      // profile_id is the ONLY column written. A trigger derives is_guest,
      // user_id and username from the profile; setting them here is how the
      // four drift apart.
      const { data, error } = await requireSupabase()
        .from("players")
        .update({ profile_id: profileId })
        .eq("id", guestId)
        .eq("group_id", group.id)
        .select("id");
      if (error) throw error;
      // An update refused by RLS comes back as zero rows and NO error, so
      // without this the page would refresh and quietly report nothing. The
      // trigger's own refusals do raise, and reach the user through the catch.
      if (!data || data.length === 0) {
        throw new Error(
          "That card could not be linked. Only a group admin can link one."
        );
      }
      await refresh();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(null);
    }
  }

  const sectionList: Array<{
    key: MemberSection;
    title: string;
    rows: Membership[];
  }> = [
    { key: "pending", title: "Requests to join", rows: sections.pending },
    { key: "active", title: "Members", rows: sections.active },
    ...(sections.inactive.length
      ? [
          {
            key: "inactive" as const,
            title: "No longer members",
            rows: sections.inactive,
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeading
        title="Members"
        subtitle={`Approve requests and manage access to ${
          group?.name ?? "this group"
        }.`}
        actions={
          <FeltButton variant="ghost" to={path("/settings")}>
            ← Settings
          </FeltButton>
        }
      />

      {/* Felt tone. This banner carried crimson-700 on the table at 1.5:1,
          so the one message that explains a refused change — including the
          last-admin trigger's, which is written to be read — could not be. */}
      {error && (
        <ErrorNote tone="felt" className="mb-4">
          {error}
        </ErrorNote>
      )}

      {members === null ? (
        <LoadingState tone="felt" full />
      ) : (
        <Sheet>
          {sectionList.map((section) => (
            <Band
              key={section.key}
              kicker={section.key === "pending" ? "Waiting" : undefined}
              title={section.title}
              caption={
                section.key === "active"
                  ? "Admins first, then alphabetical."
                  : undefined
              }
            >
              {section.rows.length === 0 ? (
                <p className="mt-2 text-sm text-ink-500">
                  {EMPTY_MESSAGE[section.key]}
                </p>
              ) : (
                <div className="mt-2 divide-y divide-card-100">
                  {section.rows.map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      section={section.key}
                      soleAdmin={
                        member.role === "admin" && activeAdminCount === 1
                      }
                      busy={busy?.id === member.id && busy.action === "member"}
                      linking={busy?.id === member.id && busy.action === "link"}
                      locked={busy !== null}
                      linkableGuests={guests}
                      onLink={(guestId) => void linkGuest(member, guestId)}
                      onUpdate={(update) => void updateMember(member.id, update)}
                    />
                  ))}
                </div>
              )}
            </Band>
          ))}
        </Sheet>
      )}
    </>
  );
}
