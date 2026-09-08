#!/usr/bin/env node
// Phase 3C second half — roster rows on activation, after the global unique
// indexes are dropped.
//
//   node scripts/smoke-3c2.mjs             # against the live schema
//   node scripts/smoke-3c2.mjs --rehearse  # apply 0013 in the txn first
//                                          # (0012 must already be applied)
//
// One transaction, ALWAYS rolled back. Builds its own throwaway accounts and
// groups; it never writes to royal or test1 beyond reading them.
//
// The point of this one is the multi-group case. players_user_id_unique meant
// an account could hold at most ONE players row app-wide, so the checks below
// deliberately put the same person on two rosters — the thing that was
// impossible before 0012.
//
// Developer tool. Not imported by the app, not bundled.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const MIGRATION = "supabase/migrations/0013_refuse_duplicate_roster_name.sql";
const rehearse = process.argv.includes("--rehearse");

const GREEN = "[32m";
const RED = "[31m";
const OFF = "[0m";

function loadEnvLocal() {
  let raw;
  try {
    raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  } catch {
    console.error("\n  No .env.local found in the current directory.\n");
    process.exit(1);
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvLocal();
if (!process.env.SUPABASE_DB_URL) {
  console.error("\n  SUPABASE_DB_URL is not set in .env.local.\n");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ${GREEN}PASS${OFF}  ${name}`);
  } else {
    failed++;
    console.log(`  ${RED}FAIL${OFF}  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function asUser(profileId, fn) {
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: profileId, role: "authenticated" }),
  ]);
  try {
    return await fn();
  } finally {
    await client.query("reset role");
    await client.query("select set_config('request.jwt.claims', NULL, true)");
  }
}

const uuid = () => crypto.randomUUID();
const tag = uuid().slice(0, 8);

async function makeAccount(handle, displayName) {
  const id = uuid();
  await client.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     values ($1, $2, $3::jsonb)`,
    [
      id,
      `${handle}-${tag}@royal.gg.local`,
      JSON.stringify({
        username: `${handle}-${tag}`,
        display_name: displayName ?? handle,
      }),
    ]
  );
  return id;
}

async function makeGroup(name, policy, ownerId) {
  const id = uuid();
  const code = `${name.toUpperCase()}${tag}`.slice(0, 20);
  await client.query(
    `insert into groups (id, name, slug, join_code, join_policy, created_by)
     values ($1, $2, $3, $4, $5, $6)`,
    [id, name, `${name}-${tag}`, code, policy, ownerId]
  );
  await client.query(
    `insert into group_members (group_id, profile_id, role, status)
     values ($1, $2, 'admin', 'active')`,
    [id, ownerId]
  );
  return { id, code };
}

const rosterRows = async (groupId, profileId) =>
  (
    await client.query(
      `select id, name, display_name, is_guest, status, user_id, username::text
         from players where group_id = $1 and profile_id = $2`,
      [groupId, profileId]
    )
  ).rows;

try {
  await client.connect();
  await client.query("begin");

  if (rehearse) {
    const sql = readFileSync(resolve(MIGRATION), "utf8")
      .replace(/^\s*begin\s*;/im, "")
      .replace(/^\s*commit\s*;/im, "");
    await client.query(sql);
    console.log(`\n  Rehearsing ${MIGRATION} inside the transaction.`);
  }

  console.log("\n  The global indexes are gone\n");

  const gone = await client.query(
    `select indexname from pg_indexes
      where schemaname='public' and tablename='players'
        and indexname in ('players_name_unique','players_user_id_unique',
                          'players_username_unique','players_chosen_card_unique')`
  );
  check("all four global unique indexes dropped", gone.rowCount === 0,
    `still present: ${gone.rows.map((r) => r.indexname).join(", ")}`);

  // players_group_card_unique was the third of these until 0019 dropped it on
  // purpose: a card is decoration, not a seat number. The two that identify a
  // person within a group are the ones that have to survive.
  const kept = await client.query(
    `select count(*)::int as n from pg_indexes
      where schemaname='public' and tablename='players'
        and indexname in ('players_group_name_unique','players_group_profile_unique')`
  );
  check("the group-scoped replacements survive", kept.rows[0].n === 2,
    `found ${kept.rows[0].n}`);

  const card = await client.query(
    `select 1 from pg_indexes
      where schemaname='public' and tablename='players'
        and indexname = 'players_group_card_unique'`
  );
  check("0019 dropped the per-group card index", card.rowCount === 0,
    "players_group_card_unique is still present");

  const trg = await client.query(
    `select 1 from pg_trigger where tgname='group_members_roster_row'
      and tgrelid='group_members'::regclass and not tgisinternal`
  );
  check("roster-row trigger exists", trg.rowCount === 1);

  console.log("\n  Existing data survived\n");

  const orphans = await client.query(
    `select count(*)::int as n from group_members gm
      where gm.status='active'
        and not exists (select 1 from players p
          where p.group_id=gm.group_id and p.profile_id=gm.profile_id)`
  );
  check("every active member now has a roster row", orphans.rows[0].n === 0,
    `${orphans.rows[0].n} without one`);

  const money = await client.query(
    `select (select coalesce(sum(amount_cents),0) from buy_ins)::text as buy_ins,
            (select coalesce(sum(reported_amount_cents),0) from cash_outs)::text as reported,
            (select coalesce(sum(adjusted_amount_cents),0) from cash_outs)::text as adjusted`
  );
  // Was a hardcoded 696000 / 696875 / 696250, the totals on 2026-09-06. Every
  // night logged since made this suite fail for a reason that had nothing to
  // do with what it tests. Snapshot and compare instead — the claim is "this
  // run moved no money", not "the league has never played again".
  const moneyBefore = money.rows[0];
  const sameMoney = (a, b) =>
    a.buy_ins === b.buy_ins && a.reported === b.reported &&
    a.adjusted === b.adjusted;

  // --- fixtures -------------------------------------------------------------
  const alice = await makeAccount("alice", "Alice");
  const bob = await makeAccount("bob", "Bob");
  const instant = await makeGroup("instant", "code", alice);
  const approve = await makeGroup("approve", "code_approve", alice);

  console.log("\n  A roster row appears on activation\n");

  const founderRoster = await rosterRows(instant.id, alice);
  check("founding a group gives the founder a roster row",
    founderRoster.length === 1, `found ${founderRoster.length}`);
  check("  named from the profile's display name",
    founderRoster[0]?.name === "Alice", `got ${founderRoster[0]?.name}`);
  check("  not a guest", founderRoster[0]?.is_guest === false);
  check("  legacy columns populated for the readers still using them",
    founderRoster[0]?.user_id === alice && founderRoster[0]?.status === "active",
    JSON.stringify(founderRoster[0]));

  await asUser(bob, async () => {
    await client.query("select join_group($1)", [instant.code]);
  });
  const instantJoin = await rosterRows(instant.id, bob);
  check("an instant join ('code') creates one, with no approval in sight",
    instantJoin.length === 1, `found ${instantJoin.length}`);

  await asUser(bob, async () => {
    await client.query("select join_group($1)", [approve.code]);
  });
  check("a pending join creates NO roster row yet",
    (await rosterRows(approve.id, bob)).length === 0);

  await asUser(alice, async () => {
    await client.query(
      "update group_members set status='active' where group_id=$1 and profile_id=$2",
      [approve.id, bob]
    );
  });
  check("approving creates it", (await rosterRows(approve.id, bob)).length === 1);

  console.log("\n  The thing players_user_id_unique used to forbid\n");

  const bobEverywhere = await client.query(
    "select count(*)::int as n from players where profile_id=$1", [bob]
  );
  check("one account now holds roster rows in TWO groups",
    bobEverywhere.rows[0].n === 2, `found ${bobEverywhere.rows[0].n}`);

  console.log("\n  Name collisions\n");

  // A guest the admin added by hand is already using the joiner's name. The
  // join is refused outright: a group with two rows a human cannot tell apart
  // can only be untangled by guest linking, which does not exist yet.
  const host = await makeAccount("host", "Host");
  const clashGroup = await makeGroup("clash", "code", host);
  const approveClash = await makeGroup("clashb", "code_approve", host);
  await client.query(
    `insert into players (group_id, name, display_name, is_guest)
     values ($1, 'Bob', 'Bob', true), ($2, 'Bob', 'Bob', true)`,
    [clashGroup.id, approveClash.id]
  );
  const clash = await makeAccount("clash2", "Bob");

  let joinErr = null;
  await asUser(clash, async () => {
    await client.query("savepoint c1");
    try {
      await client.query("select join_group($1)", [clashGroup.code]);
      await client.query("rollback to savepoint c1");
    } catch (e) {
      joinErr = e.message;
      await client.query("rollback to savepoint c1");
    }
  });
  check("a taken roster name refuses the join", joinErr !== null,
    "the join was accepted");
  check("  and says how to fix it",
    /already goes by "Bob"/.test(joinErr ?? "") &&
      /change your display name/i.test(joinErr ?? ""),
    JSON.stringify(joinErr));
  check("  leaving no membership row behind",
    (await client.query(
      "select count(*)::int as n from group_members where group_id=$1 and profile_id=$2",
      [clashGroup.id, clash]
    )).rows[0].n === 0);
  check("  and no roster row",
    (await rosterRows(clashGroup.id, clash)).length === 0);

  // Same refusal on a code_approve group: no point accepting a request that
  // could never be approved.
  let approveErr = null;
  await asUser(clash, async () => {
    await client.query("savepoint c2");
    try {
      await client.query("select join_group($1)", [approveClash.code]);
      await client.query("rollback to savepoint c2");
    } catch (e) {
      approveErr = e.message;
      await client.query("rollback to savepoint c2");
    }
  });
  // 0018 reversed the rule this used to assert. 0013 refused the clash at the
  // door under every policy, which meant no pending request was ever written —
  // and guest linking (decision 14) needs exactly that request to attach a
  // profile to. A 'code_approve' request now lands. The new behaviour is
  // asserted in smoke-0018.mjs, which owns it; repeating it here would give
  // one rule two homes that drift.
  void approveErr;

  // The backstop: a clash that only appears after the request was made.
  const later = await makeAccount("later", "Carol");
  await asUser(later, async () => {
    await client.query("select join_group($1)", [approveClash.code]);
  });
  await client.query(
    `insert into players (group_id, name, display_name, is_guest)
     values ($1, 'Carol', 'Carol', true)`,
    [approveClash.id]
  );
  let approvalErr = null;
  await asUser(host, async () => {
    await client.query("savepoint c3");
    try {
      await client.query(
        "update group_members set status='active' where group_id=$1 and profile_id=$2",
        [approveClash.id, later]
      );
      await client.query("rollback to savepoint c3");
    } catch (e) {
      approvalErr = e.message;
      await client.query("rollback to savepoint c3");
    }
  });
  check("a clash appearing later blocks the approval, aimed at the admin",
    /already taken in this group/i.test(approvalErr ?? "") &&
      /ask them/i.test(approvalErr ?? ""),
    JSON.stringify(approvalErr));

  check("no suffixed roster name exists anywhere",
    (await client.query(
      "select count(*)::int as n from players where name ~ '\\([0-9]+\\)$'"
    )).rows[0].n === 0);

  console.log("\n  Removal and restoration keep the same row\n");

  const before = (await rosterRows(instant.id, bob))[0]?.id;
  await asUser(alice, async () => {
    await client.query(
      "update group_members set status='removed' where group_id=$1 and profile_id=$2",
      [instant.id, bob]
    );
  });
  check("removing a member does NOT delete their roster row",
    (await rosterRows(instant.id, bob)).length === 1);

  await asUser(alice, async () => {
    await client.query(
      "update group_members set status='active' where group_id=$1 and profile_id=$2",
      [instant.id, bob]
    );
  });
  const after = await rosterRows(instant.id, bob);
  check("restoring reuses the SAME row, so history survives",
    after.length === 1 && after[0].id === before,
    `${before} -> ${after[0]?.id}`);

  console.log("\n  Group scoping still holds\n");

  const dupName = await client.query(
    `select count(*)::int as n from players
      where lower(name) = 'alice' and group_id in ($1, $2)`,
    [instant.id, approve.id]
  );
  check("the same name can now exist in two groups", dupName.rows[0].n === 2,
    `found ${dupName.rows[0].n}`);

  let refused = null;
  await client.query("savepoint dup");
  try {
    await client.query(
      `insert into players (group_id, name, display_name, is_guest)
       values ($1, 'Alice', 'Alice', true)`,
      [instant.id]
    );
    await client.query("rollback to savepoint dup");
  } catch (e) {
    refused = e.message;
    await client.query("rollback to savepoint dup");
  }
  check("but still NOT twice within one group", refused !== null,
    "the duplicate was accepted");

  const moneyAfter = (await client.query(
    `select (select coalesce(sum(amount_cents),0) from buy_ins)::text as buy_ins,
            (select coalesce(sum(reported_amount_cents),0) from cash_outs)::text as reported,
            (select coalesce(sum(adjusted_amount_cents),0) from cash_outs)::text as adjusted`
  )).rows[0];
  check("this run moved no money",
    sameMoney(moneyBefore, moneyAfter),
    `${moneyBefore.buy_ins}/${moneyBefore.reported}/${moneyBefore.adjusted}` +
    ` -> ${moneyAfter.buy_ins}/${moneyAfter.reported}/${moneyAfter.adjusted}`);
} catch (e) {
  failed++;
  console.error(`\n  ${RED}ERROR${OFF} ${e.message}`);
  if (e.detail) console.error(`  detail: ${e.detail}`);
  if (e.hint) console.error(`  hint: ${e.hint}`);
} finally {
  try {
    await client.query("rollback");
    console.log("\n  Rolled back — no rows were kept.");
  } catch {
    /* connection already gone */
  }
  await client.end();
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
