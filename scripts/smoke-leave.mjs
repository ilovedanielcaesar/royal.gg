#!/usr/bin/env node
// Leaving a group, and rejoining afterwards.
//
//   node scripts/smoke-leave.mjs             # against the live schema
//   node scripts/smoke-leave.mjs --rehearse  # apply 0014 in the txn first
//
// One transaction, ALWAYS rolled back. Builds its own throwaway accounts and
// groups; it never writes to royal or test1.
//
// Every call is made as the `authenticated` role with real JWT claims. The
// point of several checks below is what a member CANNOT do, which only means
// anything with RLS actually enforced.
//
// Developer tool. Not imported by the app, not bundled.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const MIGRATION = "supabase/migrations/0014_leave_group.sql";
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

/** Call and keep the result. Returns { ok } or { err }. */
async function call(sql, params) {
  await client.query("savepoint c");
  try {
    const r = await client.query(sql, params);
    await client.query("release savepoint c");
    return { ok: r.rows[0] ? Object.values(r.rows[0])[0] : null };
  } catch (e) {
    await client.query("rollback to savepoint c");
    return { err: e.message };
  }
}

/** Run and undo either way. null refused = allowed. */
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
  await client.query(
    `insert into groups (id, name, slug, join_code, join_policy, created_by)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      name,
      `${name}-${tag}`,
      `${name.toUpperCase()}${tag}`.slice(0, 20),
      policy,
      ownerId,
    ]
  );
  await client.query(
    `insert into group_members (group_id, profile_id, role, status)
     values ($1, $2, 'admin', 'active')`,
    [id, ownerId]
  );
  return { id, code: `${name.toUpperCase()}${tag}`.slice(0, 20) };
}

const memberStatus = async (groupId, profileId) =>
  (
    await client.query(
      "select status, role from group_members where group_id=$1 and profile_id=$2",
      [groupId, profileId]
    )
  ).rows[0];

const rosterRow = async (groupId, profileId) =>
  (
    await client.query(
      "select id, name from players where group_id=$1 and profile_id=$2",
      [groupId, profileId]
    )
  ).rows[0];

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

  const con = await client.query(
    `select pg_get_constraintdef(oid) as def from pg_constraint
      where conrelid='group_members'::regclass and conname='group_members_status_check'`
  );
  check("group_members.status accepts 'left'",
    /left/.test(con.rows[0]?.def ?? ""), con.rows[0]?.def ?? "constraint missing");

  const fn = await client.query(
    `select p.prosecdef, not has_function_privilege('anon', p.oid, 'execute') as anon_blocked
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='leave_group'`
  );
  check("leave_group() exists, security definer, anon blocked",
    fn.rows[0]?.prosecdef === true && fn.rows[0]?.anon_blocked === true,
    JSON.stringify(fn.rows[0]));

  const pols = await client.query(
    `select count(*)::int as n from pg_policies
      where schemaname='public' and tablename='group_members' and cmd in ('UPDATE','ALL')`
  );
  check("still exactly 2 UPDATE paths on group_members (leaving stays an RPC)",
    pols.rows[0].n === 2, `found ${pols.rows[0].n}`);

  // --- fixtures -------------------------------------------------------------
  const alice = await makeAccount("alice", "Alice");
  const bob = await makeAccount("bob", "Bob");
  const carol = await makeAccount("carol", "Carol");
  const open = await makeGroup("open", "code", alice);
  const gated = await makeGroup("gated", "code_approve", alice);

  await asUser(bob, async () => {
    await client.query("select join_group($1)", [open.code]);
  });
  const rosterBefore = await rosterRow(open.id, bob);
  check("setup: bob joined and has a roster row", Boolean(rosterBefore?.id));

  console.log("\n  Leaving\n");

  await asUser(bob, async () => {
    const r = await call("select leave_group($1) as r", [open.id]);
    check("a member can leave", r.err === undefined, r.err ?? "");
  });
  const afterLeave = await memberStatus(open.id, bob);
  check("  status is 'left', not 'removed'", afterLeave?.status === "left",
    JSON.stringify(afterLeave));
  check("  the roster row survives, same id",
    (await rosterRow(open.id, bob))?.id === rosterBefore.id,
    "history would have been lost");

  await asUser(bob, async () => {
    const r = await call("select leave_group($1) as r", [open.id]);
    check("leaving twice is a no-op", r.err === undefined && r.ok?.already_left === true,
      r.err ?? JSON.stringify(r.ok));
  });

  await asUser(carol, async () => {
    const r = await call("select leave_group($1) as r", [open.id]);
    check("a non-member cannot leave", /not a member/i.test(r.err ?? ""),
      r.err ?? "it succeeded");
  });

  console.log("\n  The sole admin cannot leave\n");

  await asUser(alice, async () => {
    const r = await call("select leave_group($1) as r", [open.id]);
    check("blocked by the last-admin trigger", /only admin/i.test(r.err ?? ""),
      r.err ?? "the group would have been left adminless");
  });

  console.log("\n  Nothing but status can change\n");

  await asUser(bob, async () => {
    const r = await probe(
      "update group_members set role='admin', status='left' where group_id=$1 and profile_id=$2",
      [open.id, bob]
    );
    check("a member has NO direct UPDATE path to their own row",
      r.rowCount === 0, r.refused ?? `matched ${r.rowCount} rows`);
  });
  check("  so their role is untouched by leaving",
    (await memberStatus(open.id, bob))?.role === "member");

  console.log("\n  Rejoining\n");

  await asUser(bob, async () => {
    const r = await call("select join_group($1) as r", [open.code]);
    check("a leaver can rejoin with the code", r.err === undefined, r.err ?? "");
    check("  'code' puts them straight back to active",
      r.ok?.status === "active", JSON.stringify(r.ok));
    check("  reported as a fresh join, not already_member",
      r.ok?.already_member === false, JSON.stringify(r.ok));
  });
  const afterRejoin = await memberStatus(open.id, bob);
  check("  back to member, not admin", afterRejoin?.role === "member",
    JSON.stringify(afterRejoin));
  check("  and the SAME roster row, so every session still counts",
    (await rosterRow(open.id, bob))?.id === rosterBefore.id);

  // The bug this migration fixes: their own roster row carries their name, so
  // the duplicate-name check would refuse them as a duplicate of themselves.
  check("  rejoining was not refused as a name clash with itself",
    afterRejoin?.status === "active");

  console.log("\n  Rejoining respects the group's join policy\n");

  await asUser(carol, async () => {
    await client.query("select join_group($1)", [gated.code]);
  });
  await asUser(alice, async () => {
    await client.query(
      "update group_members set status='active' where group_id=$1 and profile_id=$2",
      [gated.id, carol]
    );
  });
  await asUser(carol, async () => {
    await call("select leave_group($1) as r", [gated.id]);
    const r = await call("select join_group($1) as r", [gated.code]);
    check("'code_approve' sends a returning leaver back to pending",
      r.ok?.status === "pending", r.err ?? JSON.stringify(r.ok));
  });

  console.log("\n  Removal is still not the same thing\n");

  await asUser(alice, async () => {
    await client.query(
      "update group_members set status='removed' where group_id=$1 and profile_id=$2",
      [open.id, bob]
    );
  });
  await asUser(bob, async () => {
    const r = await call("select join_group($1) as r", [open.code]);
    check("a REMOVED member still cannot walk back in",
      /access to this group was removed/i.test(r.err ?? ""),
      r.err ?? "they were let back in");
  });
  await asUser(bob, async () => {
    const r = await call("select leave_group($1) as r", [open.id]);
    check("  and cannot 'leave' to launder that status",
      /not a member/i.test(r.err ?? ""), r.err ?? "it succeeded");
  });
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
