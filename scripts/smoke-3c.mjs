#!/usr/bin/env node
// Phase 3C smoke test — approvals, promote/demote/remove, last-admin guard.
//
//   node scripts/smoke-3c.mjs             # against the live schema
//   node scripts/smoke-3c.mjs --rehearse  # apply 0011 in the txn first
//
// One transaction, ALWAYS rolled back. Builds its own throwaway accounts and
// groups; it never writes to royal or test1.
//
// Every membership change is made as the `authenticated` role with real JWT
// claims, so RLS and auth.uid() are live. Running as the owning role would
// prove nothing.
//
// Developer tool. Not imported by the app, not bundled.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const MIGRATION = "supabase/migrations/0011_membership_management.sql";
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

/**
 * Run a statement and undo it either way.
 * Returns { refused, rowCount } — refused is null when it was allowed.
 * Note RLS refuses an UPDATE by matching zero rows, not by raising.
 */
async function probe(sql, params) {
  await client.query("savepoint p");
  try {
    const r = await client.query(sql, params);
    await client.query("rollback to savepoint p");
    return { refused: null, rowCount: r.rowCount };
  } catch (e) {
    await client.query("rollback to savepoint p");
    return { refused: e.message, rowCount: 0 };
  }
}

/** Same, but keeps the change when it succeeds. */
async function apply(sql, params) {
  await client.query("savepoint a");
  try {
    const r = await client.query(sql, params);
    await client.query("release savepoint a");
    return { refused: null, rowCount: r.rowCount };
  } catch (e) {
    await client.query("rollback to savepoint a");
    return { refused: e.message, rowCount: 0 };
  }
}

const uuid = () => crypto.randomUUID();
const tag = uuid().slice(0, 8);

async function makeAccount(handle) {
  const id = uuid();
  await client.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     values ($1, $2, $3::jsonb)`,
    [
      id,
      `${handle}-${tag}@royal.gg.local`,
      JSON.stringify({ username: `${handle}-${tag}`, display_name: handle }),
    ]
  );
  return id;
}

async function makeGroup(name, ownerId) {
  const id = uuid();
  await client.query(
    `insert into groups (id, name, slug, join_code, join_policy, created_by)
     values ($1, $2, $3, $4, 'code_approve', $5)`,
    [id, name, `${name}-${tag}`, `${name.toUpperCase()}${tag}`.slice(0, 20), ownerId]
  );
  await client.query(
    `insert into group_members (group_id, profile_id, role, status)
     values ($1, $2, 'admin', 'active')`,
    [id, ownerId]
  );
  return id;
}

async function addMember(groupId, profileId, status = "pending", role = "member") {
  await client.query(
    `insert into group_members (group_id, profile_id, role, status)
     values ($1, $2, $3, $4)`,
    [groupId, profileId, role, status]
  );
}

const statusOf = async (groupId, profileId) =>
  (
    await client.query(
      "select status, role from group_members where group_id=$1 and profile_id=$2",
      [groupId, profileId]
    )
  ).rows[0];

const SET_STATUS =
  "update group_members set status=$1 where group_id=$2 and profile_id=$3";
const SET_ROLE =
  "update group_members set role=$1 where group_id=$2 and profile_id=$3";

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

  console.log("\n  Schema\n");

  const pol = await client.query(
    `select 1 from pg_policies where schemaname='public'
      and tablename='group_members' and policyname='group_members_update_group_admin'`
  );
  check("group_members_update_group_admin exists", pol.rowCount === 1);

  const trg = await client.query(
    `select 1 from pg_trigger where tgname='group_members_last_admin'
      and tgrelid='group_members'::regclass and not tgisinternal`
  );
  check("last-admin guard trigger exists", trg.rowCount === 1);

  const orphaned = await client.query(
    `select count(*)::int as n from groups g
      where not exists (select 1 from group_members gm
        where gm.group_id=g.id and gm.role='admin' and gm.status='active')`
  );
  check("every live group already has an active admin", orphaned.rows[0].n === 0,
    `${orphaned.rows[0].n} without one`);

  // --- fixtures -------------------------------------------------------------
  const alice = await makeAccount("alice"); // admin of A
  const bob = await makeAccount("bob"); // pending in A
  const carol = await makeAccount("carol"); // active member of A
  const dave = await makeAccount("dave"); // admin of B
  const groupA = await makeGroup("alpha", alice);
  const groupB = await makeGroup("bravo", dave);
  await addMember(groupA, bob, "pending");
  await addMember(groupA, carol, "active");

  console.log("\n  The approvals queue\n");

  await asUser(alice, async () => {
    const r = await apply(SET_STATUS, ["active", groupA, bob]);
    check("group admin can approve a pending member",
      r.refused === null && r.rowCount === 1,
      r.refused ?? `matched ${r.rowCount} rows`);
  });
  check("  bob is now active", (await statusOf(groupA, bob))?.status === "active");

  await asUser(alice, async () => {
    const r = await probe(SET_STATUS, ["rejected", groupA, bob]);
    check("group admin can reject", r.refused === null && r.rowCount === 1,
      r.refused ?? `matched ${r.rowCount} rows`);

    const rem = await probe(SET_STATUS, ["removed", groupA, carol]);
    check("group admin can remove an active member",
      rem.refused === null && rem.rowCount === 1,
      rem.refused ?? `matched ${rem.rowCount} rows`);

    const promo = await probe(SET_ROLE, ["admin", groupA, carol]);
    check("group admin can promote a member",
      promo.refused === null && promo.rowCount === 1,
      promo.refused ?? `matched ${promo.rowCount} rows`);
  });

  console.log("\n  Who may not\n");

  await asUser(carol, async () => {
    const r = await probe(SET_STATUS, ["active", groupA, bob]);
    check("a plain member CANNOT change anyone's status", r.rowCount === 0,
      r.refused ?? `matched ${r.rowCount} rows`);

    const self = await probe(SET_ROLE, ["admin", groupA, carol]);
    check("a plain member CANNOT promote themselves", self.rowCount === 0,
      self.refused ?? `matched ${self.rowCount} rows`);
  });

  await asUser(dave, async () => {
    const r = await probe(SET_STATUS, ["active", groupA, bob]);
    check("an admin of another group CANNOT reach into this one",
      r.rowCount === 0, r.refused ?? `matched ${r.rowCount} rows`);
  });

  // The `with check` clause is what stops this, not `using` — alice legitimately
  // passes `using` for group A. A membership must not be smugglable into a
  // group the editor does not also run.
  await asUser(alice, async () => {
    const r = await probe(
      "update group_members set group_id=$1 where group_id=$2 and profile_id=$3",
      [groupB, groupA, bob]
    );
    check("an admin CANNOT move a membership into a group they don't run",
      r.refused !== null, `matched ${r.rowCount} rows with no error`);
  });

  console.log("\n  Last-admin guard\n");

  await asUser(alice, async () => {
    const demote = await probe(SET_ROLE, ["member", groupA, alice]);
    check("the only admin CANNOT demote themselves",
      /only admin/i.test(demote.refused ?? ""),
      demote.refused ?? "it was allowed");

    const leave = await probe(SET_STATUS, ["removed", groupA, alice]);
    check("the only admin CANNOT remove themselves",
      /only admin/i.test(leave.refused ?? ""),
      leave.refused ?? "it was allowed");
  });

  const del = await probe(
    "delete from group_members where group_id=$1 and profile_id=$2",
    [groupA, alice]
  );
  check("the only admin's row CANNOT be deleted outright",
    /only admin/i.test(del.refused ?? ""),
    del.refused ?? "it was allowed");

  // Promote carol for real, then alice may step down.
  await client.query(SET_ROLE, ["admin", groupA, carol]);
  await asUser(alice, async () => {
    const demote = await probe(SET_ROLE, ["member", groupA, alice]);
    check("with a second admin present, the first may step down",
      demote.refused === null && demote.rowCount === 1,
      demote.refused ?? `matched ${demote.rowCount} rows`);
  });

  // A second admin who is only *pending* does not count as cover.
  await client.query(SET_ROLE, ["member", groupA, carol]);
  await addMember(groupA, dave, "pending", "admin");
  await asUser(alice, async () => {
    const demote = await probe(SET_ROLE, ["member", groupA, alice]);
    check("a pending admin does not count as the group's admin",
      /only admin/i.test(demote.refused ?? ""),
      demote.refused ?? "it was allowed");
  });

  console.log("\n  Roster rows, once 3C's second half delivered them\n");

  // Written before 0012, when approving created no roster row and 3C still
  // owed one. 0012 added the activation trigger, so the durable rule is now
  // the one that trigger enforces: a roster row exists for exactly the active
  // memberships. Stated that way it survives the next change to joining.
  const roster = await client.query(
    `select count(*)::int as n
       from group_members gm
      where gm.profile_id = any($1::uuid[])
        and (gm.status = 'active') is distinct from exists (
          select 1 from players p
           where p.group_id = gm.group_id and p.profile_id = gm.profile_id)`,
    [[alice, bob, carol, dave]]
  );
  check("a roster row exists for exactly the active memberships",
    roster.rows[0].n === 0, `${roster.rows[0].n} disagree`);
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
