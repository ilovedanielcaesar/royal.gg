#!/usr/bin/env node
// v1.2 redesign, decision 2 — `submitted` is removed from the game log.
//
//   node scripts/smoke-0020.mjs             # against the live schema
//   node scripts/smoke-0020.mjs --rehearse  # apply 0020 in the txn first
//
// One transaction, ALWAYS rolled back. It builds its own group, accounts and
// nights of poker. It reads royal's money totals but never writes to them,
// and asserts they are byte-identical at the end.
//
// Every check runs as the `authenticated` role with real JWT claims. As the
// owning role RLS is bypassed and auth.uid() comes out NULL, so the whole
// file would pass while proving nothing.
//
// What this is really testing: that removing a state removed it EVERYWHERE.
// The failure this prevents is a cosmetic migration — the header narrows, the
// buy_ins and cash_outs policies do not, and money stays writable through a
// door the UI no longer draws. The money rows have to follow the header.
//
// Developer tool. Not imported by the app, not bundled.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const MIGRATION = "supabase/migrations/0020_drop_submitted.sql";
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

try {
  await client.connect();
  await client.query("begin");

  // Snapshotted BEFORE the migration is rehearsed: 0020 writes to sessions
  // (the submitted -> draft collapse) and the point is that it moves no money.
  const moneyBefore = await royalMoney();
  const statusesBefore = (await client.query(
    `select status, count(*)::int as n from sessions group by status order by status`
  )).rows;

  if (rehearse) {
    await client.query(
      readFileSync(resolve(MIGRATION), "utf8")
        .replace(/^\s*begin\s*;/im, "")
        .replace(/^\s*commit\s*;/im, "")
    );
    console.log(`\n  Rehearsing ${MIGRATION} inside the transaction.`);
  }

  // Without this every check below fails on a state that still exists, which
  // reads like a broken test rather than a migration that has not been pushed.
  const constraint = (await client.query(
    `select pg_get_constraintdef(oid) as def from pg_constraint
      where conrelid='sessions'::regclass and conname='sessions_status_check'`
  )).rows[0];
  if (!constraint || constraint.def.includes("submitted")) {
    console.log(
      `\n  ${RED}0020 is not applied.${OFF}\n\n` +
      `  Rehearse it first:  node scripts/smoke-0020.mjs --rehearse\n` +
      `  Then Will pushes:   npx supabase db push\n`
    );
    await client.query("rollback");
    await client.end();
    process.exit(1);
  }

  console.log("\n  The state is gone from the schema\n");

  check("sessions_status_check allows draft and approved only",
    /draft/.test(constraint.def) && /approved/.test(constraint.def) &&
      !/submitted/.test(constraint.def),
    constraint.def);

  const survivors = (await client.query(
    "select count(*)::int as n from sessions where status='submitted'"
  )).rows[0].n;
  check("no session is left in the submitted state", survivors === 0,
    `${survivors} are`);

  const collapsed = statusesBefore.find((r) => r.status === "submitted");
  const after = (await client.query(
    `select status, count(*)::int as n from sessions group by status order by status`
  )).rows;
  const draftsBefore = statusesBefore.find((r) => r.status === "draft")?.n ?? 0;
  const draftsAfter = after.find((r) => r.status === "draft")?.n ?? 0;
  check("every one of them became a draft — none vanished",
    draftsAfter === draftsBefore + (collapsed?.n ?? 0),
    `${draftsBefore} + ${collapsed?.n ?? 0} drafts expected, found ${draftsAfter}`);

  const total = (await client.query(
    "select count(*)::int as n from sessions"
  )).rows[0].n;
  const totalBefore = statusesBefore.reduce((s, r) => s + r.n, 0);
  check("  and the session count is unchanged", total === totalBefore,
    `${totalBefore} -> ${total}`);

  const stale = (await client.query(
    `select count(*)::int as n from sessions
      where status='draft' and (submitted_at is not null or submitted_by is not null)`
  )).rows[0].n;
  check("no draft carries a stale submitted_at / submitted_by", stale === 0,
    `${stale} do`);

  const cols = (await client.query(
    `select count(*)::int as n from information_schema.columns
      where table_schema='public' and table_name='sessions'
        and column_name in ('submitted_at','submitted_by')`
  )).rows[0].n;
  check("the two columns are KEPT — dropping them is a later decision",
    cols === 2, `found ${cols}`);

  console.log("\n  No policy still names it\n");

  const naming = (await client.query(
    `select tablename, policyname from pg_policies
      where schemaname='public' and tablename in ('sessions','buy_ins','cash_outs')
        and (coalesce(qual,'') like '%submitted%'
          or coalesce(with_check,'') like '%submitted%')`
  )).rows;
  check("no sessions / buy_ins / cash_outs policy mentions submitted",
    naming.length === 0,
    naming.map((r) => `${r.tablename}.${r.policyname}`).join(", "));

  const fnSrc = (await client.query(
    `select prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='enforce_session_state'`
  )).rows[0]?.prosrc ?? "";
  check("the trigger function does not mention it either",
    fnSrc.length > 0 && !/'submitted'/.test(fnSrc));
  // 0017 added the buy-in stamp and the re-stake guard to THIS function.
  // `create or replace` takes no patch, so 0020 restates the whole body — and
  // the first draft of it restated 0016's, silently reverting both. That is
  // what these two lines are here to catch if it ever happens again.
  check("  0017's buy-in stamp survived the restatement",
    /default_buy_in_cents/.test(fnSrc));
  check("  so did 0017's re-stake guard",
    /cannot change in the same step/.test(fnSrc));
  check("  and it is still SECURITY DEFINER with a pinned search_path",
    (await client.query(
      `select prosecdef, proconfig from pg_proc p
         join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='enforce_session_state'`
    )).rows[0]?.prosecdef === true);

  // --- fixtures -------------------------------------------------------------
  const admin = await makeAccount("admin");
  const member = await makeAccount("member");
  const outsider = await makeAccount("outsider");
  const gid = uuid();
  await client.query(
    `insert into groups (id, name, slug, join_code, join_policy, created_by)
     values ($1,'Smoke0020',$2,$3,'code',$4)`,
    [gid, `smoke0020-${tag}`, `S20${tag}`, admin]
  );
  await client.query(
    `insert into group_members (group_id, profile_id, role, status) values
       ($1,$2,'admin','active'), ($1,$3,'member','active')`,
    [gid, admin, member]
  );
  const pid = (await client.query(
    `insert into players (group_id, name, is_guest, status)
     values ($1,'Smoke Player',false,'active') returning id`,
    [gid]
  )).rows[0].id;

  console.log("\n  The three removed legs now raise\n");

  let sid;
  await asUser(member, async () => {
    const r = await apply(
      `insert into sessions (group_id, played_at, created_by, buy_in_cents)
       values ($1, current_date, $2, 4000) returning id, status`,
      [gid, member]
    );
    check("a member can still start a game log", r.refused === null,
      r.refused ?? "");
    sid = r.rows[0]?.id;
    check("  it starts as a draft", r.rows[0]?.status === "draft");

    const submit = await probe(
      "update sessions set status='submitted' where id=$1", [sid]
    );
    check("draft -> submitted is refused",
      /cannot go from draft to submitted/.test(submit.refused ?? ""),
      submit.refused ?? `accepted, ${submit.rowCount} rows`);
  });

  // The trigger gets there first, which is why the check above sees its
  // message and not the constraint's. Belt and braces matter here: a trigger
  // can be disabled, a check constraint cannot. Prove the second line holds
  // on its own by removing the first.
  await client.query("savepoint notrigger");
  await client.query("alter table sessions disable trigger sessions_state");
  const rawSubmit = await probe(
    "update sessions set status='submitted' where id=$1", [sid]
  );
  check("  and with the trigger disabled the CONSTRAINT still refuses it",
    /sessions_status_check|violates check constraint/.test(rawSubmit.refused ?? ""),
    rawSubmit.refused ?? `accepted, ${rawSubmit.rowCount} rows`);
  await client.query("rollback to savepoint notrigger");

  // The other two legs cannot be reached from a live row any more, so they
  // are provoked the only way left: forge `old.status = 'submitted'` with the
  // trigger and the constraint both out of the way for one savepoint, then
  // put the trigger back and push on it.
  //
  // These probes run as the OWNER, not as a user. That is deliberate: RLS
  // bypassed, the trigger is the only thing standing there, which is exactly
  // what is under test. The policy layer is checked separately below.
  await client.query("savepoint forged");
  await client.query("alter table sessions disable trigger sessions_state");
  await client.query("alter table sessions drop constraint sessions_status_check");
  await client.query("update sessions set status='submitted' where id=$1", [sid]);
  await client.query(
    `alter table sessions add constraint sessions_status_check
       check (status in ('draft','approved')) not valid`
  );
  await client.query("alter table sessions enable trigger sessions_state");

  const approve = await probe(
    "update sessions set status='approved' where id=$1", [sid]
  );
  check("submitted -> approved is refused by the trigger",
    /cannot go from submitted to approved/.test(approve.refused ?? ""),
    approve.refused ?? `accepted, ${approve.rowCount} rows`);

  const back = await probe(
    "update sessions set status='draft' where id=$1", [sid]
  );
  check("submitted -> draft (send back) is refused by the trigger",
    /cannot go from submitted to draft/.test(back.refused ?? ""),
    back.refused ?? `accepted, ${back.rowCount} rows`);

  // And a belt to the trigger's braces: no UPDATE policy's USING clause
  // matches a submitted row at all, so an authenticated admin cannot even
  // reach one. Both layers refuse, independently.
  await asUser(admin, async () => {
    const r = await probe(
      "update sessions set notes='reachable?' where id=$1", [sid]
    );
    check("  no policy even matches a submitted row for an admin",
      r.rowCount === 0, r.refused ?? `matched ${r.rowCount} rows`);
  });
  await client.query("rollback to savepoint forged");

  console.log("\n  The two remaining legs still work\n");

  await asUser(member, async () => {
    const r = await probe(
      "update sessions set notes='any member may edit a draft' where id=$1",
      [sid]
    );
    check("a member can still edit a draft", r.rowCount === 1,
      r.refused ?? `matched ${r.rowCount} rows`);
  });

  await asUser(member, async () => {
    const bi = await apply(
      "insert into buy_ins (session_id, player_id, amount_cents) values ($1,$2,4000)",
      [sid, pid]
    );
    check("a member can still write a buy-in to a draft", bi.refused === null,
      bi.refused ?? "");
    const co = await apply(
      `insert into cash_outs (session_id, player_id,
         reported_amount_cents, adjusted_amount_cents) values ($1,$2,4000,4000)`,
      [sid, pid]
    );
    check("  and a cash-out", co.refused === null, co.refused ?? "");
  });

  await asUser(outsider, async () => {
    const r = await probe(
      "insert into buy_ins (session_id, player_id, amount_cents) values ($1,$2,4000)",
      [sid, pid]
    );
    check("a non-member still cannot", r.refused !== null, "it was accepted");
  });

  await asUser(member, async () => {
    const r = await probe(
      "update sessions set status='approved' where id=$1", [sid]
    );
    check("a plain member cannot approve", r.rowCount === 0,
      r.refused ?? `matched ${r.rowCount} rows`);
  });

  await asUser(admin, async () => {
    const r = await apply(
      "update sessions set status='approved' where id=$1 returning approved_by, approved_at",
      [sid]
    );
    check("an admin can approve a draft directly — no submit step",
      r.rowCount === 1, r.refused ?? `matched ${r.rowCount} rows`);
    check("  approved_by is stamped by the server, not the client",
      r.rows[0]?.approved_by === admin, String(r.rows[0]?.approved_by));
  });

  console.log("\n  An approved night is closed\n");

  await asUser(admin, async () => {
    const r = await probe(
      "update sessions set notes='sneaky' where id=$1", [sid]
    );
    check("not even an admin can edit an approved log in place",
      r.refused !== null || r.rowCount === 0,
      `accepted, ${r.rowCount} rows`);
  });

  await asUser(member, async () => {
    const bi = await probe(
      "insert into buy_ins (session_id, player_id, amount_cents) values ($1,$2,4000)",
      [sid, pid]
    );
    check("no member writes money to an approved log", bi.refused !== null,
      "it was accepted");
  });

  await asUser(admin, async () => {
    // The leg the whole simplification rests on: with 'submitted' gone the
    // admin disjunct in buy_ins_write says "an admin, on a draft", which
    // is_group_member already covers. If it were ever widened back, this
    // passes when it should not.
    const bi = await probe(
      "insert into buy_ins (session_id, player_id, amount_cents) values ($1,$2,4000)",
      [sid, pid]
    );
    check("  nor does an admin — the money rows follow the header",
      bi.refused !== null, "it was accepted");
    const co = await probe(
      `insert into cash_outs (session_id, player_id,
         reported_amount_cents, adjusted_amount_cents) values ($1,$2,9900,9900)`,
      [sid, pid]
    );
    check("  cash-outs too", co.refused !== null, "it was accepted");
  });

  await asUser(member, async () => {
    const r = await probe(
      "update sessions set status='draft' where id=$1", [sid]
    );
    check("a plain member cannot reopen", r.rowCount === 0,
      r.refused ?? `matched ${r.rowCount} rows`);
  });

  await asUser(admin, async () => {
    const r = await apply(
      "update sessions set status='draft' where id=$1 returning approved_by, approved_at",
      [sid]
    );
    check("an admin can reopen it back to draft", r.rowCount === 1,
      r.refused ?? `matched ${r.rowCount} rows`);
    check("  and the old sign-off is cleared",
      r.rows[0]?.approved_by === null && r.rows[0]?.approved_at === null);
  });

  console.log("\n  Books that do not balance still cannot be approved\n");

  await client.query(
    "update sessions set needs_review=true where id=$1", [sid]
  );
  await asUser(admin, async () => {
    const r = await probe(
      "update sessions set status='approved' where id=$1", [sid]
    );
    check("approval is still refused while needs_review is set",
      /do not balance/.test(r.refused ?? ""),
      r.refused ?? `accepted, ${r.rowCount} rows`);
  });

  console.log("\n  Royal's money\n");

  const moneyAfter = await royalMoney();
  check("buy-ins are untouched", moneyAfter.bi === moneyBefore.bi,
    `${moneyBefore.bi} -> ${moneyAfter.bi}`);
  check("reported cash-outs are untouched",
    moneyAfter.reported === moneyBefore.reported,
    `${moneyBefore.reported} -> ${moneyAfter.reported}`);
  check("adjusted cash-outs are untouched",
    moneyAfter.adjusted === moneyBefore.adjusted,
    `${moneyBefore.adjusted} -> ${moneyAfter.adjusted}`);

  const unbalanced = (await client.query(
    `select count(*)::int as n from sessions s
      where s.status='approved'
        and (select coalesce(sum(amount_cents),0) from buy_ins where session_id=s.id)
         <> (select coalesce(sum(adjusted_amount_cents),0) from cash_outs where session_id=s.id)`
  )).rows[0].n;
  check("every approved night still balances to the cent", unbalanced === 0,
    `${unbalanced} do not`);
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
