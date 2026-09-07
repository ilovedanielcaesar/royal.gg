#!/usr/bin/env node
// Group isolation — the migration that decides whether one group can read
// another's money.
//
//   node scripts/smoke-rls.mjs             # against the live schema
//   node scripts/smoke-rls.mjs --rehearse  # apply 0015 in the txn first
//
// One transaction, ALWAYS rolled back.
//
// Every check runs as the `authenticated` role with real JWT claims, because
// that is the only way any of this means anything: as the owning role RLS is
// bypassed entirely and every check below would pass while the database leaked.
//
// It reads the REAL royal and test1 groups (never writes to them) precisely so
// the numbers are the ones that matter.
//
// Developer tool. Not imported by the app, not bundled.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const MIGRATION = "supabase/migrations/0015_rls_isolation.sql";
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

const count = async (sql, params = []) =>
  Number((await client.query(sql, params)).rows[0].n);

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

async function makeAccount(handle, { appOwner = false } = {}) {
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
  if (appOwner) {
    await client.query("update profiles set is_app_owner = true where id = $1", [id]);
  }
  return id;
}

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

  console.log("\n  The policy surface\n");

  const permissive = await client.query(
    `select tablename, policyname from pg_policies
      where schemaname='public' and qual = 'true'
        and tablename in ('players','sessions','buy_ins','cash_outs','payouts',
                          'profiles','groups','group_members','group_invites')`
  );
  check("no using(true) SELECT policy survives",
    permissive.rowCount === 0,
    permissive.rows.map((r) => `${r.tablename}.${r.policyname}`).join(", "));

  const stillAdmin = await count(
    `select count(*)::int as n from pg_policies
      where schemaname='public'
        and (coalesce(qual,'') like '%is_admin()%'
          or coalesce(with_check,'') like '%is_admin()%')`
  );
  check("no policy still references is_admin()", stillAdmin === 0,
    `${stillAdmin} do`);

  const adminFn = await count(
    `select count(*)::int as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='is_admin'`
  );
  check("is_admin() itself is gone", adminFn === 0);

  const ownerLeak = await client.query(
    `select tablename, policyname from pg_policies
      where schemaname='public'
        and tablename in ('players','sessions','buy_ins','cash_outs','payouts')
        and (coalesce(qual,'') like '%is_app_owner%'
          or coalesce(with_check,'') like '%is_app_owner%')`
  );
  check("is_app_owner() appears on NO money table (GROUPS.md §6)",
    ownerLeak.rowCount === 0,
    ownerLeak.rows.map((r) => `${r.tablename}.${r.policyname}`).join(", "));

  const rlsOff = await client.query(
    `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and not c.relrowsecurity
        and c.relname in ('players','sessions','buy_ins','cash_outs','payouts',
                          'profiles','groups','group_members','group_invites')`
  );
  check("row level security is enabled on all nine tables",
    rlsOff.rowCount === 0, rlsOff.rows.map((r) => r.relname).join(", "));

  // --- the real groups ------------------------------------------------------
  const ids = await client.query(
    `select
       (select id from groups where slug='royal') as royal,
       (select id from groups where slug='test1') as test1,
       (select id from profiles where username='will')  as will,
       (select id from profiles where username='dale')  as dale`
  );
  const { royal, test1, will, dale } = ids.rows[0];

  const truth = await client.query(
    `select
       (select count(*)::int from players  where group_id=$1) as players,
       (select count(*)::int from sessions where group_id=$1) as sessions,
       (select count(*)::int from buy_ins b join sessions s on s.id=b.session_id
         where s.group_id=$1) as buy_ins,
       (select count(*)::int from players where group_id=$2) as test1_players`,
    [royal, test1]
  );
  const t = truth.rows[0];

  // Pinned by id, resolved at runtime. An earlier version of the check below
  // updated every session in royal and expected zero rows, on the reasoning
  // that they were all approved. Two were reopened on 2026-09-07 to fix nights
  // that never balanced, and a member editing a draft is exactly right — so the
  // check failed on correct data. Ask for an approved row instead of assuming
  // one.
  const approvedId = (
    await client.query(
      "select id from sessions where group_id=$1 and status='approved' limit 1",
      [royal]
    )
  ).rows[0]?.id;
  const draftId = (
    await client.query(
      "select id from sessions where group_id=$1 and status='draft' limit 1",
      [royal]
    )
  ).rows[0]?.id;

  console.log(`\n  A member of royal (${t.players} players, ${t.sessions} sessions)\n`);

  await asUser(dale, async () => {
    check("sees royal's players",
      (await count("select count(*)::int as n from players where group_id=$1", [royal]))
        === t.players);
    check("sees royal's sessions",
      (await count("select count(*)::int as n from sessions where group_id=$1", [royal]))
        === t.sessions);
    check("sees royal's buy-ins",
      (await count(
        `select count(*)::int as n from buy_ins b join sessions s on s.id=b.session_id
          where s.group_id=$1`, [royal])) === t.buy_ins);

    // dale is 'left' in test1, so not an active member of it.
    check("sees NONE of test1's players",
      (await count("select count(*)::int as n from players where group_id=$1", [test1]))
        === 0, `test1 really has ${t.test1_players}`);
    check("sees NONE of test1's sessions",
      (await count("select count(*)::int as n from sessions where group_id=$1", [test1]))
        === 0);
    check("sees NONE of test1's cash-outs",
      (await count(
        `select count(*)::int as n from cash_outs c join sessions s on s.id=c.session_id
          where s.group_id=$1`, [test1])) === 0);
    check("cannot even see the test1 group row",
      (await count("select count(*)::int as n from groups where id=$1", [test1])) === 0);
  });

  // 0015 let only an admin write a session. 0016 reverses that on purpose —
  // GROUPS.md §4, "create a game log" is a member's right — so what is worth
  // asserting is no longer "a member cannot", but the shape of what they can:
  // their own draft, in their own group, starting at the bottom of the ladder.
  console.log("\n  A member writes drafts, and only drafts\n");

  await asUser(dale, async () => {
    // The trigger defaults created_by to auth.uid(); that default is what
    // satisfies sessions_insert_member's `created_by = auth.uid()` check.
    const s = await probe(
      "insert into sessions (group_id, played_at) values ($1, current_date)", [royal]
    );
    check("CAN start a draft", s.refused === null, s.refused ?? "");

    const forged = await probe(
      `insert into sessions (group_id, played_at, created_by)
        values ($1, current_date, $2)`, [royal, will]
    );
    check("cannot put someone else's name on it", forged.refused !== null,
      "the insert succeeded");

    const jumped = await probe(
      `insert into sessions (group_id, played_at, status)
        values ($1, current_date, 'approved')`, [royal]
    );
    check("cannot open one pre-approved", jumped.refused !== null,
      "the insert succeeded");

    const foreign = await probe(
      "insert into sessions (group_id, played_at) values ($1, current_date)", [test1]
    );
    check("cannot start one in a group they are not in", foreign.refused !== null,
      "the insert succeeded");

    const u = await probe(
      "update sessions set review_note='x' where id=$1", [approvedId]
    );
    check("cannot edit an approved one", u.rowCount === 0,
      u.refused ?? `matched ${u.rowCount} rows`);

    // The other half of the same rule, and the reason the check above had to be
    // narrowed rather than widened: a reopened night is a draft, and any member
    // may work on it.
    if (draftId) {
      const d = await probe(
        "update sessions set review_note='x' where id=$1", [draftId]
      );
      check("  but CAN edit a reopened one, which is the point of a draft",
        d.rowCount === 1, d.refused ?? `matched ${d.rowCount} rows`);
    }

    const p = await probe("delete from payouts where group_id=$1", [royal]);
    check("cannot delete a payout", p.rowCount === 0,
      p.refused ?? `matched ${p.rowCount} rows`);

    const own = await probe(
      `update players set chosen_suit='spade', chosen_rank='A'
        where group_id=$1 and profile_id=$2`, [royal, dale]
    );
    check("CAN still pick their own card", own.rowCount === 1,
      own.refused ?? `matched ${own.rowCount} rows`);

    const other = await probe(
      `update players set chosen_suit='heart' where group_id=$1 and profile_id=$2`,
      [royal, will]
    );
    check("cannot edit somebody else's row", other.rowCount === 0,
      other.refused ?? `matched ${other.rowCount} rows`);
  });

  console.log("\n  The group's admin still runs it, without is_admin()\n");

  await asUser(will, async () => {
    const s = await probe(
      "insert into sessions (group_id, played_at) values ($1, current_date)", [royal]
    );
    check("can create a session in royal", s.refused === null, s.refused ?? "");
    check("can see royal's sessions",
      (await count("select count(*)::int as n from sessions where group_id=$1", [royal]))
        === t.sessions);
    check("can see test1's too, being its admin",
      (await count("select count(*)::int as n from players where group_id=$1", [test1]))
        === t.test1_players);
  });

  console.log("\n  A stranger with no groups\n");

  const stranger = await makeAccount("stranger");
  await asUser(stranger, async () => {
    for (const [label, sql] of [
      ["players", "select count(*)::int as n from players"],
      ["sessions", "select count(*)::int as n from sessions"],
      ["buy-ins", "select count(*)::int as n from buy_ins"],
      ["cash-outs", "select count(*)::int as n from cash_outs"],
      ["payouts", "select count(*)::int as n from payouts"],
      ["groups", "select count(*)::int as n from groups"],
    ]) {
      const n = await count(sql);
      check(`sees zero ${label}`, n === 0, `saw ${n}`);
    }
    check("cannot read another person's profile",
      (await count("select count(*)::int as n from profiles where id=$1", [will])) === 0);
    check("can read their own",
      (await count("select count(*)::int as n from profiles where id=$1", [stranger])) === 1);
  });

  console.log("\n  The superadmin sees people, never money (GROUPS.md §6)\n");

  const owner = await makeAccount("owner", { appOwner: true });
  await asUser(owner, async () => {
    check("can list every account",
      (await count("select count(*)::int as n from profiles")) >= 12);
    check("can list every group",
      (await count("select count(*)::int as n from groups")) >= 3);
    check("can list every membership",
      (await count("select count(*)::int as n from group_members")) >= 13);

    for (const [label, sql] of [
      ["players", "select count(*)::int as n from players"],
      ["sessions", "select count(*)::int as n from sessions"],
      ["buy-ins", "select count(*)::int as n from buy_ins"],
      ["cash-outs", "select count(*)::int as n from cash_outs"],
      ["payouts", "select count(*)::int as n from payouts"],
    ]) {
      const n = await count(sql);
      check(`sees ZERO ${label}`, n === 0, `saw ${n} — the promise is broken`);
    }
  });

  console.log("\n  Founding a group still works end to end\n");

  const founder = await makeAccount("founder");
  await asUser(founder, async () => {
    const gid = uuid();
    // INSERT ... RETURNING is what CreateGroupPage does, and at this instant
    // the founder has no membership row — only groups_select's created_by arm
    // makes the returned row visible.
    const r = await client.query(
      `insert into groups (id, name, slug, join_code, created_by)
       values ($1,$2,$3,$4,$5) returning id, slug::text`,
      [gid, "Founded", `founded-${tag}`, `FND${tag}`, founder]
    );
    check("INSERT ... RETURNING gives the founder their new group back",
      r.rowCount === 1 && r.rows[0].id === gid,
      "groups_select would have returned an empty row");

    const m = await probe(
      `insert into group_members (group_id, profile_id, role, status)
       values ($1,$2,'admin','active')`, [gid, founder]
    );
    check("and they can make themselves its admin", m.refused === null,
      m.refused ?? "");
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
