import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../components/Card";
import MemberRow from "../components/MemberRow";
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
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-card-50">Members</h1>
          <p className="mt-1 text-sm text-card-50/60">
            Approve requests and manage access to {group?.name ?? "this group"}.
          </p>
        </div>
        <Link
          className="text-sm text-card-50/70 underline hover:text-card-50"
          to={path("/")}
        >
          Dashboard →
        </Link>
      </header>

      {error && (
        <div className="rounded-md bg-crimson-500/10 px-3 py-2 text-xs text-crimson-700">
          {error}
        </div>
      )}

      {members === null ? (
        <p className="text-card-50/60">Dealing…</p>
      ) : (
        sectionList.map((section) => (
          <section key={section.key}>
            <h2 className="mb-2 font-display text-2xl text-card-50">
              {section.title}
            </h2>
            <Card accent={section.key === "pending" ? "gold" : "neutral"}>
              {section.rows.length === 0 ? (
                <p className="p-5 text-sm text-ink-500">
                  {EMPTY_MESSAGE[section.key]}
                </p>
              ) : (
                <div className="divide-y divide-card-200">
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
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
