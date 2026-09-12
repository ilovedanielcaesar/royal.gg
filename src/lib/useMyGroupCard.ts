import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useCurrentUser } from "./auth";
import { describeError } from "./errors";
import type { Rank, Suit } from "./playerSuit";
import { requireSupabase } from "./supabase";

export type ChosenCard = { suit: Suit | null; rank: Rank | null };

/**
 * The card the signed-in user picked in the group they are currently looking
 * at, or null when there is no such group.
 *
 * The header sits ABOVE `GroupProvider` — it is rendered by `AppLayout`, and
 * the provider only exists inside the `/g/:slug` route — so there is no group
 * context to read. `GroupNav` solves the same problem the same way: the URL is
 * the source of the slug.
 *
 * This is one small indexed lookup (`players_group_profile_idx`) rather than a
 * lift of `GroupProvider` above the layout, which would put every page's
 * chrome behind a group fetch including the pages that have no group.
 *
 * Re-reads on navigation, like `GroupSwitcher`: this component never unmounts,
 * so keying on the user alone would keep showing the card from the group you
 * just left.
 */
export function useMyGroupCard(): ChosenCard | null {
  const { user } = useCurrentUser();
  const userId = user?.id ?? null;
  const { pathname } = useLocation();
  const slug = pathname.match(/^\/g\/([^/]+)/)?.[1] ?? null;
  const [card, setCard] = useState<{
    userId: string;
    slug: string;
    card: ChosenCard | null;
  } | null>(null);

  useEffect(() => {
    if (!userId || !slug) return;

    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await requireSupabase()
          .from("players")
          .select("chosen_suit, chosen_rank, groups!inner(slug)")
          .eq("profile_id", userId)
          .eq("groups.slug", slug)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        setCard({
          userId,
          slug,
          card: data
            ? { suit: data.chosen_suit, rank: data.chosen_rank }
            : null,
        });
      } catch (caught) {
        if (cancelled) return;
        // A missing card is a cosmetic problem, never a blocking one — the
        // avatar falls back to the hashed card. Log it and move on rather
        // than surfacing an error banner in the chrome of every page.
        console.error("Failed to load your group card:", describeError(caught));
        setCard({ userId, slug, card: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, userId]);

  if (!userId || !slug) return null;
  // Guard against showing the previous group's card for a frame after a
  // switch, which is the one thing worse than showing the hashed fallback.
  if (card?.userId !== userId || card.slug !== slug) return null;
  return card.card;
}
