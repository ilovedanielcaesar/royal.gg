import type { Database } from "../types/database";

type Profile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "username" | "display_name"
>;

/** An unclaimed roster card that can be linked to a joining account. */
export type LinkableGuest = Pick<
  Database["public"]["Tables"]["players"]["Row"],
  "id" | "name" | "display_name"
>;

/** A group_members row with the account behind it. */
export type Membership = Pick<
  Database["public"]["Tables"]["group_members"]["Row"],
  "id" | "role" | "status" | "created_at"
> & { profiles: Profile | null };

export type MemberUpdate =
  Database["public"]["Tables"]["group_members"]["Update"];

/** Which of the three lists a row is being shown in. */
export type MemberSection = "pending" | "active" | "inactive";

/**
 * Wording of the last-admin guard in migration 0011. The database is what
 * actually refuses; this is only so the disabled button can say why.
 */
export const ONLY_ADMIN_REASON =
  "This is the group's only admin. Promote someone else first.";

export function memberName(member: Membership): string {
  return member.profiles?.display_name ?? "Unknown member";
}

export function guestName(guest: LinkableGuest): string {
  return guest.display_name ?? guest.name;
}
