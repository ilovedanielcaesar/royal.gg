import { useMemo } from "react";
import Card from "../components/Card";
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
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-card-50">Admin overview</h1>
        <p className="mt-1 text-sm text-card-50/70">
          This view shows accounts, groups, and memberships only. It never
          shows any group’s games or money.
        </p>
      </header>

      {data?.error && (
        <Card accent="crimson">
          <p className="p-4 text-sm text-crimson-700">{data.error}</p>
        </Card>
      )}

      {!data ? (
        <p className="text-sm text-card-50/60">Dealing in…</p>
      ) : !data.error ? (
        <>
          <section>
            <h2 className="mb-2 font-display text-2xl text-card-50">Groups</h2>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-card-200 text-xs text-ink-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Group
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Join policy
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-medium"
                      >
                        Members
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-medium"
                      >
                        Admins
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-200">
                    {data.groups.map((group) => {
                      const count = counts.byGroup.get(group.id);
                      return (
                        <tr key={group.id}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-ink-900">
                              {group.name}
                            </div>
                            <div className="text-xs text-ink-500">
                              /{group.slug}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-ink-700">
                            {group.join_policy === "code"
                              ? "Join code"
                              : "Join code + approval"}
                          </td>
                          <td className="px-4 py-3 text-right tabular text-ink-700">
                            {count?.members ?? 0}
                          </td>
                          <td className="px-4 py-3 text-right tabular text-ink-700">
                            {count?.admins ?? 0}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-ink-500">
                            {createdDate.format(new Date(group.created_at))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {data.groups.length === 0 && (
                  <p className="p-4 text-sm text-ink-500">No groups exist.</p>
                )}
              </div>
            </Card>
          </section>

          <section>
            <h2 className="mb-2 font-display text-2xl text-card-50">Accounts</h2>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-card-200 text-xs text-ink-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Account
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Username
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-medium"
                      >
                        Groups
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-200">
                    {data.profiles.map((profile) => (
                      <tr key={profile.id}>
                        <td className="px-4 py-3 font-medium text-ink-900">
                          {profile.display_name}
                          {profile.id === user?.id && (
                            <span className="ml-2 rounded bg-gold-500/20 px-2 py-0.5 text-xs text-ink-700">
                              You · app owner
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-ink-700">
                          @{profile.username ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular text-ink-700">
                          {counts.byProfile.get(profile.id) ?? 0}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-500">
                          {createdDate.format(new Date(profile.created_at))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.profiles.length === 0 && (
                  <p className="p-4 text-sm text-ink-500">No accounts exist.</p>
                )}
              </div>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
