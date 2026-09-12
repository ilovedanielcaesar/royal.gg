import { useMemo } from "react";
import Band from "../components/Band";
import ErrorNote from "../components/ErrorNote";
import GoldPill from "../components/GoldPill";
import LoadingState from "../components/LoadingState";
import PageHeading from "../components/PageHeading";
import Sheet from "../components/Sheet";
import { useCurrentUser } from "../lib/auth";
import useAdminOverviewData from "../lib/useAdminOverviewData";

const createdDate = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default function AdminOverviewPage() {
  const { user } = useCurrentUser();
  const data = useAdminOverviewData(user?.id);
  const counts = useMemo(() => {
    const byGroup = new Map<string, { members: number; admins: number }>();
    const byProfile = new Map<string, number>();
    for (const membership of data?.memberships ?? []) {
      if (membership.status !== "active") continue;
      const group = byGroup.get(membership.group_id) ?? {
        members: 0,
        admins: 0,
      };
      group.members += 1;
      if (membership.role === "admin") group.admins += 1;
      byGroup.set(membership.group_id, group);
      byProfile.set(
        membership.profile_id,
        (byProfile.get(membership.profile_id) ?? 0) + 1
      );
    }
    return { byGroup, byProfile };
  }, [data?.memberships]);

  return (
    <>
      <PageHeading
        title="Admin overview"
        subtitle="Accounts, groups, and memberships only. It never shows any group's games or money."
      />

      {data?.error && (
        <ErrorNote tone="felt" className="mb-4">
          {data.error}
        </ErrorNote>
      )}

      {!data ? (
        <LoadingState tone="felt" full />
      ) : !data.error ? (
        <Sheet>
          <Band
            kicker="Tables"
            title="Groups"
            caption={`${data.groups.length} in total.`}
          >
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-card-200 text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase">
                  <tr>
                    <th scope="col" className="px-2 py-3">
                      Group
                    </th>
                    <th scope="col" className="px-2 py-3">
                      Join policy
                    </th>
                    <th scope="col" className="px-2 py-3 text-right">
                      Members
                    </th>
                    <th scope="col" className="px-2 py-3 text-right">
                      Admins
                    </th>
                    <th scope="col" className="px-2 py-3">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-100">
                  {data.groups.map((group) => {
                    const count = counts.byGroup.get(group.id);
                    return (
                      <tr key={group.id}>
                        <td className="px-2 py-3">
                          <div className="font-medium text-ink-900">
                            {group.name}
                          </div>
                          <div className="text-xs text-ink-500">
                            /{group.slug}
                          </div>
                        </td>
                        <td className="px-2 py-3 text-ink-700">
                          {group.join_policy === "code"
                            ? "Join code"
                            : "Join code + approval"}
                        </td>
                        {/* A count is not money, so it stays ink. */}
                        <td className="tabular px-2 py-3 text-right text-ink-700">
                          {count?.members ?? 0}
                        </td>
                        <td className="tabular px-2 py-3 text-right text-ink-700">
                          {count?.admins ?? 0}
                        </td>
                        <td className="px-2 py-3 whitespace-nowrap text-ink-500">
                          {createdDate.format(new Date(group.created_at))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {data.groups.length === 0 && (
                <p className="py-4 text-sm text-ink-500">No groups exist.</p>
              )}
            </div>
          </Band>

          <Band
            kicker="People"
            title="Accounts"
            caption={`${data.profiles.length} in total.`}
          >
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-card-200 text-[10px] font-semibold tracking-[0.13em] text-ink-500 uppercase">
                  <tr>
                    <th scope="col" className="px-2 py-3">
                      Account
                    </th>
                    <th scope="col" className="px-2 py-3">
                      Username
                    </th>
                    <th scope="col" className="px-2 py-3 text-right">
                      Groups
                    </th>
                    <th scope="col" className="px-2 py-3">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-100">
                  {data.profiles.map((profile) => (
                    <tr key={profile.id}>
                      <td className="px-2 py-3 font-medium text-ink-900">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {profile.display_name}
                          {profile.id === user?.id && (
                            <GoldPill>You · app owner</GoldPill>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-ink-700">
                        @{profile.username ?? "—"}
                      </td>
                      <td className="tabular px-2 py-3 text-right text-ink-700">
                        {counts.byProfile.get(profile.id) ?? 0}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-ink-500">
                        {createdDate.format(new Date(profile.created_at))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.profiles.length === 0 && (
                <p className="py-4 text-sm text-ink-500">No accounts exist.</p>
              )}
            </div>
          </Band>
        </Sheet>
      ) : null}
    </>
  );
}
