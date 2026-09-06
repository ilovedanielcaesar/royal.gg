import { useEffect, useMemo, useState } from "react";
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

async function fetchMembers(groupId: string): Promise<Membership[]> {
  const { data, error } = await requireSupabase()
    .from("group_members")
    .select("id, role, status, created_at, profiles(id, username, display_name)")
    .eq("group_id", groupId);
  if (error) throw error;
  return (data ?? []) as unknown as Membership[];
}

const EMPTY_MESSAGE: Record<MemberSection, string> = {
  pending: "No requests waiting.",
  active: "No active members.",
  inactive: "Nobody has left or been removed.",
};

export default function GroupMembersPage() {
  const { group, isGroupAdmin, path } = useGroup();
  const [members, setMembers] = useState<Membership[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!group) return;
    let cancelled = false;
    setMembers(null);
    setError(null);
    void fetchMembers(group.id)
      .then((rows) => {
        if (!cancelled) setMembers(rows);
      })
      .catch((caught) => {
        if (!cancelled) {
          setMembers([]);
          setError(describeError(caught));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [group]);

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
    if (!group || !isGroupAdmin || busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const { error } = await requireSupabase()
        .from("group_members")
        .update(update)
        .eq("id", id)
        .eq("group_id", group.id);
      if (error) throw error;
      setMembers(await fetchMembers(group.id));
    } catch (caught) {
      // Includes the last-admin trigger, whose message is written to be read.
      setError(describeError(caught));
    } finally {
      setBusyId(null);
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
                      busy={busyId === member.id}
                      locked={busyId !== null}
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
