import { useMemo } from "react";
import { useCurrentUser } from "../../lib/auth";
import { useLeagueData } from "../../lib/useLeagueData";
import { buildPlayerProfile, type ProfileData } from "./profileData";

/**
 * Your own profile: the roster row attached to your account.
 */
export function useProfileData(): {
  data: ProfileData | null;
  error: string | null;
  reload: () => Promise<void>;
} {
  const { user } = useCurrentUser();
  const { data: league, error, reload } = useLeagueData();
  const userId = user?.id ?? null;

  const data = useMemo<ProfileData | null>(
    () =>
      league
        ? buildPlayerProfile(
            league,
            // A missing user id must not match a guest row's null profile id.
            userId
              ? league.players.find((entry) => entry.profile_id === userId) ??
                  null
              : null
          )
        : null,
    [league, userId]
  );

  return { data, error, reload };
}

/**
 * Somebody else's profile, by roster id.
 *
 * Same builder, so `/g/:slug/players/:id` renders the same bands as your own
 * page. That is the point: a page that shows Priya's record in a different
 * shape from yours is two pages to keep in step, and they will not stay in
 * step.
 */
export function usePlayerProfileData(playerId: string | undefined): {
  data: ProfileData | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
} {
  const { data: league, loading, error, reload } = useLeagueData();

  const data = useMemo<ProfileData | null>(
    () =>
      league
        ? buildPlayerProfile(
            league,
            league.players.find((entry) => entry.id === playerId) ?? null
          )
        : null,
    [league, playerId]
  );

  return { data, loading, error, reload };
}
