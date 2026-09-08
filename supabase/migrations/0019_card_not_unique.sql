-- QoL item 5 — a profile card no longer has to be unique within a league.
--
-- What this changes. players_group_card_unique, created in 0007, made
-- (group_id, chosen_suit, chosen_rank) unique: at most one A♠ per group, ever.
-- That was the wrong rule. A card is how someone likes to see themselves in
-- the group, not a seat number, and treating it as a scarce resource produced
-- three problems that all disappear together:
--
--   1. Two people who both want A♠ cannot both have it, and the second one to
--      join is told no by a database index.
--   2. The picker had to show which of 52 cards were already claimed, so it
--      had to render all 52 as a grid — see SuitRankPicker, which shrinks to a
--      suit row plus a rank row once nothing is greyed out.
--   3. The claim was racy in a way the UI could not fix. The greyed-out list
--      is a snapshot taken at page load; two people setting up at the same
--      time both saw the same card free, and one of them got a 23505 on Save.
--      MyGroupProfilePage carried an isCardTaken() helper to translate that
--      error into a sentence. It is deleted with this migration.
--
-- What is deliberately NOT dropped. The other two group-scoped indexes from
-- 0007 stand, and they are the ones that matter:
--
--   players_group_name_unique     (group_id, lower(name))
--   players_group_profile_unique  (group_id, profile_id) where not null
--
-- A name still identifies a person within a group, and one account still holds
-- at most one roster row per group. The card is now decoration, which means
-- every place that renders a card MUST render a name beside it — a bare
-- PlayerAvatar no longer identifies anybody.
--
-- No data changes. Dropping a unique index cannot invalidate existing rows,
-- and nothing is rewritten. This is reversible only while no two players in a
-- group share a card; after that, re-adding the index would need the
-- duplicates resolved first.

drop index if exists players_group_card_unique;

comment on column players.chosen_suit is
  'Player''s chosen suit. Decoration, not identity: NOT unique within a group '
  'since 0019. Null means fall back to the deterministic pick in '
  'lib/playerSuit.ts. Always render a name alongside the card.';

comment on column players.chosen_rank is
  'Player''s chosen rank. See chosen_suit — not unique within a group.';
