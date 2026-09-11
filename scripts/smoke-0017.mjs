#!/usr/bin/env node
// Phase 5, decision 13 — the session buy-in stamp.
//
//   node scripts/smoke-0017.mjs             # against the live schema
//   node scripts/smoke-0017.mjs --rehearse  # apply 0017 in the txn first
//
// One transaction, ALWAYS rolled back. Builds its own group, accounts and
// sessions; it reads royal's numbers but never writes to them.
//
// Every check runs as the `authenticated` role with real JWT claims. As the
// owning role RLS is bypassed and auth.uid() comes out NULL, so the whole file
// would pass while proving nothing.
//
// What this is really testing: that a night keeps the stake it was played at
// even after the group moves to different stakes. That is the one thing 0017
// exists for, and the failure it prevents is silent.
//
// Developer tool. Not imported by the app, not bundled.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const MIGRATION = "supabase/migrations/0017_session_buy_in.sql";
// 0020 removed the `submitted` state from the same trigger 0017 owns. This
// file's approval walk now goes draft -> approved, so --rehearse lays down
// whichever of the two is still missing and neither of the ones that are not.
const SUCCESSOR = "supabase/migrations/0020_drop_submitted.sql";
const rehearse = process.argv.includes("--rehearse");

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
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
      JSON.stringify({ username: `${handle}-${tag}`, display_name: handle }),
    ]
  );
  return id;
}

const sessionRow = async (id) =>
  (await client.query("select * from sessions where id=$1", [id])).rows[0];

try {
  await client.connect();
  await client.query("begin");

  const strip = (path) =>
    readFileSync(resolve(path), "utf8")
      .replace(/^\s*begin\s*;/im, "")
      .replace(/^\s*commit\s*;/im, "");

  if (rehearse) {
    const missing = async (sql) =>
      (await client.query(sql)).rows[0].n === 0;

    if (await missing(
      `select count(*)::int as n from information_schema.columns
        where table_schema='public' and table_name='sessions'
          and column_name='buy_in_cents'`
    )) {
      await client.query(strip(MIGRATION));
      console.log(`\n  Rehearsing ${MIGRATION} inside the transaction.`);
    }

    if (await missing(
      `select count(*)::int as n from pg_constraint
        where conrelid='sessions'::regclass and conname='sessions_status_check'
          and pg_get_constraintdef(oid) not like '%submitted%'`
    )) {
      await client.query(strip(SUCCESSOR));
      console.log(`  Rehearsing ${SUCCESSOR} inside the transaction.`);
    }
  }

  // Without this the first check fails on a missing column and everything
  // after it dies on "column s.buy_in_cents does not exist", which reads like a
  // broken test rather than a migration that has not been pushed.
  const applied = await client.query(
    `select 1 from information_schema.columns
      where table_schema='public' and table_name='sessions'
        and column_name='buy_in_cents'`
  );
  if (applied.rowCount === 0) {
    console.log(
      `\n  ${RED}0017 is not applied.${OFF}\n\n` +
      `  Rehearse it first:  node scripts/smoke-0017.mjs --rehearse\n` +
      `  Then Will pushes:   npx supabase db push\n`
    );
    await client.query("rollback");
    await client.end();
    process.exit(1);
  }

  console.log("\n  Schema\n");

  const col = await client.query(
    `select is_nullable, data_type from information_schema.columns
      where table_schema='public' and table_name='sessions'
        and column_name='buy_in_cents'`
  );
  check("sessions.buy_in_cents exists", col.rowCount === 1);
  check("  it is NOT NULL", col.rows[0]?.is_nullable === "NO");
  check("  and an integer, not a float — money is cents",
    col.rows[0]?.data_type === "integer", col.rows[0]?.data_type);

  const ck = await client.query(
    `select 1 from pg_constraint
      where conrelid='sessions'::regclass
        and conname='sessions_buy_in_cents_positive'`
  );
  check("a zero or negative stake is refused by a constraint", ck.rowCount === 1);

  console.log("\n  The backfill tells the truth about what was played\n");

  const mismatched = await client.query(
    `select count(*)::int as n from sessions s
      where exists (select 1 from buy_ins b where b.session_id = s.id)
        and s.buy_in_cents <> (
          select max(b.amount_cents) from buy_ins b where b.session_id = s.id)`
  );
  check("every night that recorded buy-ins kept the stake it recorded",
    mismatched.rows[0].n === 0, `${mismatched.rows[0].n} disagree`);

  // test-phase-4 is configured at $20 but its session was logged at $40,
  // because the app never read the group's value. What happened wins.
  const recorded = await client.query(
    `select s.buy_in_cents, g.default_buy_in_cents
       from sessions s join groups g on g.id = s.group_id
      where g.slug='test-phase-4' limit 1`
  );
  if (recorded.rowCount === 1) {
    const { buy_in_cents, default_buy_in_cents } = recorded.rows[0];
    check("a night logged at odds with its group's setting keeps what happened",
      buy_in_cents === 4000 && default_buy_in_cents !== 4000,
      `stamped ${buy_in_cents}, group says ${default_buy_in_cents}`);
  }

  const none = await client.query(
    "select count(*)::int as n from sessions where buy_in_cents is null"
  );
  check("no session was left without a stake", none.rows[0].n === 0);

  // --- fixtures -------------------------------------------------------------
  const admin = await makeAccount("admin");
  const member = await makeAccount("member");
  const gid = uuid();
  await client.query(
    `insert into groups (id, name, slug, join_code, join_policy, created_by,
                         default_buy_in_cents)
     values ($1,'Stakes',$2,$3,'code',$4, 4000)`,
    [gid, `stakes-${tag}`, `S17${tag}`, admin]
  );
  await client.query(
    `insert into group_members (group_id, profile_id, role, status) values
       ($1,$2,'admin','active'), ($1,$3,'member','active')`,
    [gid, admin, member]
  );

  console.log("\n  A new log is stamped from the group\n");

  let oldNight;
  await asUser(member, async () => {
    const r = await apply(
      `insert into sessions (group_id, played_at) values ($1, current_date)
       returning id, buy_in_cents`,
      [gid]
    );
    check("the stake is stamped without the client sending one",
      r.rows[0]?.buy_in_cents === 4000, r.refused ?? `got ${r.rows[0]?.buy_in_cents}`);
    oldNight = r.rows[0]?.id;

    const explicit = await probe(
      `insert into sessions (group_id, played_at, buy_in_cents)
       values ($1, current_date, 2000) returning buy_in_cents`,
      [gid]
    );
    check("  a one-off night at other stakes may still name its own",
      explicit.rows[0]?.buy_in_cents === 2000,
      explicit.refused ?? `got ${explicit.rows[0]?.buy_in_cents}`);

    const zero = await probe(
      `insert into sessions (group_id, played_at, buy_in_cents)
       values ($1, current_date, 0)`, [gid]
    );
    check("  but not a free one", zero.refused !== null, "0 was accepted");
  });

  console.log("\n  THE POINT: the group moves, the past does not\n");

  await asUser(member, async () => {
    await apply(
      `insert into buy_ins (session_id, player_id, amount_cents)
       select $1, p.id, 4000 from players p where p.group_id=$2 limit 1`,
      [oldNight, gid]
    );
  });

  // The group raises its stakes, exactly as the Phase 5 settings page will.
  await asUser(admin, async () => {
    const r = await apply(
      "update groups set default_buy_in_cents=5000 where id=$1", [gid]
    );
    check("an admin raises the group to $50", r.rowCount === 1, r.refused ?? "");
  });

  let row = await sessionRow(oldNight);
  check("the night logged at $40 is STILL stamped $40",
    row.buy_in_cents === 4000, `it now reads ${row.buy_in_cents}`);

  await asUser(member, async () => {
    await apply("update sessions set notes='reopened and edited' where id=$1",
      [oldNight]);
  });
  row = await sessionRow(oldNight);
  check("  and editing that night does not drag it to $50",
    row.buy_in_cents === 4000, `it now reads ${row.buy_in_cents}`);

  await asUser(member, async () => {
    const r = await apply(
      `insert into sessions (group_id, played_at) values ($1, current_date)
       returning buy_in_cents`, [gid]
    );
    check("  while a night played AFTER the change is stamped $50",
      r.rows[0]?.buy_in_cents === 5000,
      r.refused ?? `got ${r.rows[0]?.buy_in_cents}`);
  });

  console.log("\n  The stake cannot move under an approval\n");

  // 0020 removed the submitted step; an admin approves the draft directly.
  await asUser(admin, async () => {
    const sneak = await probe(
      "update sessions set status='approved', buy_in_cents=5000 where id=$1",
      [oldNight]
    );
    check("approving and re-staking in one statement is refused",
      sneak.refused !== null, "it was accepted");

    const plain = await apply(
      "update sessions set status='approved' where id=$1", [oldNight]
    );
    check("  approving on its own still works", plain.refused === null,
      plain.refused ?? "");
  });

  row = await sessionRow(oldNight);
  check("  and the approved night reads $40", row.buy_in_cents === 4000,
    `it reads ${row.buy_in_cents}`);

  await asUser(admin, async () => {
    const closed = await probe(
      "update sessions set buy_in_cents=5000 where id=$1", [oldNight]
    );
    check("an approved night's stake is closed even to the admin",
      /approved/i.test(closed.refused ?? ""),
      closed.refused ?? `accepted, matched ${closed.rowCount} rows`);

    // Allowed on purpose, and asserted so it stays a decision rather than an
    // accident: the row lands as a draft with the sign-off cleared, which is
    // the same end state as reopening and then editing.
    const reopen = await probe(
      "update sessions set status='draft', buy_in_cents=5000 where id=$1",
      [oldNight]
    );
    check("  but reopening and re-staking together is allowed",
      reopen.refused === null && reopen.rowCount === 1,
      reopen.refused ?? `matched ${reopen.rowCount} rows`);
  });

  await asUser(member, async () => {
    const nope = await probe(
      "update sessions set buy_in_cents=5000 where id=$1", [oldNight]
    );
    check("  and a member cannot re-stake an approved night at all",
      nope.rowCount === 0, nope.refused ?? `matched ${nope.rowCount} rows`);
  });

  console.log("\n  0015 and 0016 still hold\n");

  const leak = await client.query(
    `select tablename, policyname from pg_policies
      where schemaname='public' and tablename in ('sessions','buy_ins','cash_outs')
        and (qual='true' or coalesce(qual,'') like '%is_app_owner%')`
  );
  check("no permissive or superadmin policy on a money table",
    leak.rowCount === 0,
    leak.rows.map((r) => `${r.tablename}.${r.policyname}`).join(", "));

  // Not "every legacy night is still approved". That was a snapshot, and it
  // expired the moment Will used 4B's Reopen on the two nights that never
  // balanced — which is the feature working, not a fault. Assert the RULE the
  // trigger enforces instead: a night that does not balance cannot be
  // approved. That one cannot expire, because the database refuses to break it.
  const unbalanced = await client.query(
    "select count(*)::int as n from sessions where status='approved' and needs_review"
  );
  check("no approved night is carrying books that do not balance",
    unbalanced.rows[0].n === 0, `${unbalanced.rows[0].n} are`);

  // CLAUDE.md's reconciliation invariant, and nothing asserted it until now:
  // the reported figure has to survive alongside the adjusted one, or an
  // adjustment cannot be undone.
  const lost = await client.query(
    `select count(*)::int as n from cash_outs
      where reported_amount_cents is null or adjusted_amount_cents is null`
  );
  check("every cash-out still has BOTH its reported and adjusted figure",
    lost.rows[0].n === 0, `${lost.rows[0].n} lost one`);

  await asUser(member, async () => {
    const jump = await probe(
      `insert into sessions (group_id, played_at, status)
       values ($1, current_date, 'approved')`, [gid]
    );
    check("a log still cannot be created already approved", jump.refused !== null,
      "it was accepted");
  });
} catch (e) {
  failed++;
  console.error(`\n  ${RED}ERROR${OFF}  ${e.message}\n`);
} finally {
  await client.query("rollback");
  await client.end();
  console.log("\n  Rolled back — no rows were kept.\n");
  console.log(`  ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}
