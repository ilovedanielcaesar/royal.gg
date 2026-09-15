#!/usr/bin/env node
// Pre-release audit, finding 1 — ensure_group_roster_row() stops being a
// public API.
//
//   node scripts/smoke-0021.mjs             # against the live schema
//   node scripts/smoke-0021.mjs --rehearse  # apply 0021 in the txn first
//
// One transaction, ALWAYS rolled back. It builds its own group and accounts.
// It reads royal's money totals but never writes to them, and asserts they
// are byte-identical at the end.
//
// Every check runs as the `authenticated` role with real JWT claims. As the
// owning role RLS is bypassed and auth.uid() comes out NULL, so the whole
// file would pass while proving nothing — and for THIS migration that would
// be especially hollow, since what is being tested is a privilege that the
// owner holds either way.
//
// What this is really testing, in two halves that have to both hold:
//
//   1. The door is shut. A signed-in non-member can no longer reach
//      ensure_group_roster_row() directly.
//   2. The room is still in use. Approving a member, and joining by code,
//      both still create a roster row — because both reach the same function
//      through a security definer caller, which the revoke does not touch.
//
// Half 1 alone would pass if someone dropped the function entirely, and that
// would break every join in the app. The failure this file prevents is
// closing the hole by breaking the feature.
//
// Developer tool. Not imported by the app, not bundled.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const MIGRATION = "supabase/migrations/0021_revoke_roster_rpc_grant.sql";
const rehearse = process.argv.includes("--rehearse");

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const OFF = "\x1b[0m";

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

function note(text) {
  console.log(`  ${DIM}····  ${text}${OFF}`);
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

/** Run and undo either way. */
async function probe(sql, params) {
  await client.query("savepoint p");
  try {
    const r = await client.query(sql, params);
    await client.query("rollback to savepoint p");
    return { refused: null, rowCount: r.rowCount, rows: r.rows };
  } catch (e) {
    await client.query("rollback to savepoint p");
    return { refused: e.message, rowCount: 0, rows: [] };
  }
}

/** Run and keep it. */
async function apply(sql, params) {
  await client.query("savepoint a");
  try {
    const r = await client.query(sql, params);
    await client.query("release savepoint a");
    return { refused: null, rowCount: r.rowCount, rows: r.rows };
  } catch (e) {
    await client.query("rollback to savepoint a");
    return { refused: e.message, rowCount: 0, rows: [] };
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
      JSON.stringify({ username: `${handle}-${tag}`, display_name: `${handle}-${tag}` }),
    ]
  );
  return id;
}

/**
 * Royal's money, as three numbers. Snapshotted before this run touches
 * anything and compared at the end. A hardcoded total goes stale the next
 * time a night is logged, and a stale total fails for the wrong reason.
 */
const royalMoney = async () =>
  (await client.query(
    `select (select coalesce(sum(amount_cents),0) from buy_ins b
               join sessions s on s.id=b.session_id
               join groups   g on g.id=s.group_id where g.slug='royal')::int as bi,
            (select coalesce(sum(reported_amount_cents),0) from cash_outs c
               join sessions s on s.id=c.session_id
               join groups   g on g.id=s.group_id where g.slug='royal')::int as reported,
            (select coalesce(sum(adjusted_amount_cents),0) from cash_outs c
               join sessions s on s.id=c.session_id
               join groups   g on g.id=s.group_id where g.slug='royal')::int as adjusted`
  )).rows[0];

const canExecute = async (role) =>
  (await client.query(
    `select has_function_privilege($1, 'public.ensure_group_roster_row(uuid, uuid)', 'execute') as ok`,
    [role]
  )).rows[0].ok;

try {
  await client.connect();
  await client.query("begin");

  const moneyBefore = await royalMoney();
  const playersBefore = (
    await client.query("select count(*)::int as n from players")
  ).rows[0].n;

  // --- the cast --------------------------------------------------------
  //
  // owner   founds the victim group and admins it
  // member  joins it legitimately, by code
  // outsider belongs to nothing, and is who the escalation would be run as
  const owner = await makeAccount("owner");
  const member = await makeAccount("member");
  const outsider = await makeAccount("outsider");

  const joinCode = `SMOKE${tag.slice(0, 3).toUpperCase()}`;
  const group = (
    await asUser(owner, () =>
      client.query(
        `insert into groups (name, slug, join_code, join_policy, created_by)
         values ($1, $2, $3, 'code_approve', $4) returning id`,
        [`smoke ${tag}`, `smoke-${tag}`, joinCode, owner]
      )
    )
  ).rows[0].id;

  await asUser(owner, () =>
    client.query(
      `insert into group_members (group_id, profile_id, role, status)
       values ($1, $2, 'admin', 'active')`,
      [group, owner]
    )
  );

  console.log(`\n  Victim group smoke-${tag}, founded by owner-${tag}.`);
  console.log(`  outsider-${tag} is not a member of it and never becomes one.\n`);

  // --- the pre-state, recorded before anything is changed ---------------
  //
  // Informational, not a pass/fail: once 0021 is pushed this correctly stops
  // being reproducible, and a test that demands the hole exist would then
  // fail forever. It is printed because "the exploit no longer works" is only
  // meaningful next to evidence that it once did.
  const hadHole = await canExecute("authenticated");
  note(
    hadHole
      ? "pre-state: authenticated CAN execute the function (the hole is open)"
      : "pre-state: authenticated cannot execute it already (0021 is live)"
  );

  if (rehearse) {
    await client.query(
      readFileSync(resolve(MIGRATION), "utf8")
        .replace(/^\s*begin\s*;/im, "")
        .replace(/^\s*commit\s*;/im, "")
    );
    console.log(`\n  Rehearsing ${MIGRATION} inside the transaction.\n`);
  }

  if (!rehearse && hadHole) {
    console.log(
      `\n  ${RED}0021 has not been pushed.${OFF} Re-run with --rehearse to ` +
        `test it before pushing.\n`
    );
  }

  // --- half 1: the door is shut ----------------------------------------

  check("authenticated cannot execute ensure_group_roster_row", !(await canExecute("authenticated")));
  check("anon cannot execute ensure_group_roster_row", !(await canExecute("anon")));

  const escalation = await asUser(outsider, () =>
    probe(`select ensure_group_roster_row($1::uuid, $2::uuid) as id`, [
      group,
      member,
    ])
  );
  check(
    "an outsider calling it directly is refused",
    /permission denied/i.test(escalation.refused ?? ""),
    escalation.refused
      ? `refused with: ${escalation.refused}`
      : `IT SUCCEEDED and returned ${escalation.rows[0]?.id}`
  );

  // The same call as the group's own admin is refused too. The revoke is not
  // "members may not, admins may" — it is "no browser may, ever". An admin
  // adding a roster row goes through players_insert_admin, which is RLS and
  // still works.
  const adminDirect = await asUser(owner, () =>
    probe(`select ensure_group_roster_row($1::uuid, $2::uuid) as id`, [
      group,
      member,
    ])
  );
  check(
    "even the group's own admin is refused the direct call",
    /permission denied/i.test(adminDirect.refused ?? ""),
    adminDirect.refused ?? "IT SUCCEEDED"
  );

  // --- half 2: the room is still in use --------------------------------

  const joined = await asUser(member, () =>
    apply(`select join_group($1) as result`, [joinCode])
  );
  check(
    "join_group() still works for a real member",
    joined.refused === null && joined.rows[0]?.result?.status === "pending",
    joined.refused ?? JSON.stringify(joined.rows[0]?.result)
  );

  // Approving is what fires roster_row_on_activation, which is the only
  // caller that matters. If the revoke had reached the definer path, this is
  // where it would show.
  const approved = await asUser(owner, () =>
    apply(
      `update group_members set status='active'
        where group_id=$1 and profile_id=$2`,
      [group, member]
    )
  );
  check(
    "an admin can approve the pending member",
    approved.refused === null && approved.rowCount === 1,
    approved.refused ?? `rowCount ${approved.rowCount}`
  );

  const roster = await client.query(
    `select id, name, is_guest, status from players
      where group_id=$1 and profile_id=$2`,
    [group, member]
  );
  check(
    "approval created the member's roster row through the definer path",
    roster.rowCount === 1 && roster.rows[0].is_guest === false &&
      roster.rows[0].status === "active",
    roster.rowCount === 0
      ? "no roster row — the revoke broke the trigger"
      : JSON.stringify(roster.rows[0])
  );

  // The other legitimate path: join_policy 'code' lands 'active' directly, so
  // join_group and the roster trigger fire in one statement.
  await client.query(`update groups set join_policy='code' where id=$1`, [group]);
  const straightIn = await makeAccount("straight");
  const joinedActive = await asUser(straightIn, () =>
    apply(`select join_group($1) as result`, [joinCode])
  );
  check(
    "joining a 'code' group lands active in one statement",
    joinedActive.refused === null &&
      joinedActive.rows[0]?.result?.status === "active",
    joinedActive.refused ?? JSON.stringify(joinedActive.rows[0]?.result)
  );
  const straightRoster = await client.query(
    `select count(*)::int as n from players where group_id=$1 and profile_id=$2`,
    [group, straightIn]
  );
  check(
    "...and their roster row was written in the same statement",
    straightRoster.rows[0].n === 1,
    `found ${straightRoster.rows[0].n}`
  );

  // --- nothing of royal's was touched ----------------------------------

  const moneyAfter = await royalMoney();
  check(
    "royal's money is byte-identical",
    moneyBefore.bi === moneyAfter.bi &&
      moneyBefore.reported === moneyAfter.reported &&
      moneyBefore.adjusted === moneyAfter.adjusted,
    `${JSON.stringify(moneyBefore)} -> ${JSON.stringify(moneyAfter)}`
  );

  const playersAfter = (
    await client.query("select count(*)::int as n from players")
  ).rows[0].n;
  note(
    `players ${playersBefore} -> ${playersAfter} inside the txn ` +
      `(this run's own rows; all of it rolls back)`
  );
} catch (e) {
  failed++;
  console.error(`\n  ${RED}THREW${OFF} ${e.message}`);
} finally {
  try {
    await client.query("rollback");
    console.log(`\n  Rolled back. Nothing in this run was kept.`);
  } catch {
    /* connection already gone */
  }
  await client.end();
}

console.log(
  `\n  ${passed} passed, ${failed} failed.${
    failed ? ` ${RED}NOT SAFE TO PUSH.${OFF}` : ` ${GREEN}OK.${OFF}`
  }\n`
);
process.exit(failed ? 1 : 0);
