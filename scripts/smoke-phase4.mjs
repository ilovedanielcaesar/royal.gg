#!/usr/bin/env node
// Phase 4 — the game log lifecycle: draft -> submitted -> approved.
//
//   node scripts/smoke-phase4.mjs             # against the live schema
//   node scripts/smoke-phase4.mjs --rehearse  # apply 0016 in the txn first
//                                             # (0015 must already be applied)
//
// One transaction, ALWAYS rolled back. Builds its own group, members and
// sessions; it never writes to royal or test1.
//
// Every check runs as the `authenticated` role with real JWT claims. As the
// owning role RLS is bypassed and the trigger's auth.uid() stamps come out
// NULL, so the whole file would pass while proving nothing.
//
// Developer tool. Not imported by the app, not bundled.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const MIGRATION = "supabase/migrations/0016_game_log_states.sql";
// 0016 builds on 0015's policy surface. If 0015 has not been pushed yet, apply
// it inside the same rolled-back transaction so this can still be rehearsed.
const PREREQ = "supabase/migrations/0015_rls_isolation.sql";
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

/** Run and undo either way. */
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

const SET_STATUS = "update sessions set status=$1 where id=$2";

try {
  await client.connect();
  await client.query("begin");

  const strip = (path) =>
    readFileSync(resolve(path), "utf8")
      .replace(/^\s*begin\s*;/im, "")
      .replace(/^\s*commit\s*;/im, "");

  if (rehearse) {
    const prereqApplied =
      (
        await client.query(
          `select count(*)::int as n from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname='public' and p.proname='is_app_owner'`
        )
      ).rows[0].n === 1;
    if (!prereqApplied) {
      await client.query(strip(PREREQ));
      console.log(`\n  ${PREREQ} is not pushed yet — applying it first.`);
    }
    await client.query(strip(MIGRATION));
    console.log(`  Rehearsing ${MIGRATION} inside the transaction.`);
  }

  console.log("\n  Schema\n");

  const trg = await client.query(
    `select 1 from pg_trigger where tgname='sessions_state'
      and tgrelid='sessions'::regclass and not tgisinternal`
  );
  check("state trigger exists", trg.rowCount === 1);

  const leak = await client.query(
    `select tablename, policyname from pg_policies
      where schemaname='public' and tablename in ('sessions','buy_ins','cash_outs')
        and (qual = 'true' or coalesce(qual,'') like '%is_app_owner%')`
  );
  check("0015's guarantees survive on the money tables", leak.rowCount === 0,
    leak.rows.map((r) => `${r.tablename}.${r.policyname}`).join(", "));

  // Not "every legacy night is still approved". That was a snapshot, and it
  // expired the moment Will used 4B's Reopen on the two nights that never
  // balanced — which is the feature working, not a fault. Assert the RULE the
  // trigger enforces instead: a night that does not balance cannot be
  // approved. That one cannot expire, because the database refuses to break it.
  const historical = await client.query(
    "select count(*)::int as n from sessions where status='approved' and needs_review"
  );
  check("no approved session is carrying books that do not balance",
    historical.rows[0].n === 0, `${historical.rows[0].n} are`);

  // --- fixtures -------------------------------------------------------------
  const admin = await makeAccount("admin");
  const member = await makeAccount("member");
  const other = await makeAccount("other");
  const gid = uuid();
  await client.query(
    `insert into groups (id, name, slug, join_code, join_policy, created_by)
     values ($1,'Phase4',$2,$3,'code',$4)`,
    [gid, `phase4-${tag}`, `P4${tag}`, admin]
  );
  await client.query(
    `insert into group_members (group_id, profile_id, role, status) values
       ($1,$2,'admin','active'), ($1,$3,'member','active')`,
    [gid, admin, member]
  );

  console.log("\n  A member keeps the log\n");

  let sid;
  await asUser(member, async () => {
    const r = await apply(
      `insert into sessions (group_id, played_at, created_by)
       values ($1, current_date, $2) returning id, status, created_by`,
      [gid, member]
    );
    check("a member can start a game log", r.refused === null, r.refused ?? "");
    sid = r.rows[0]?.id;
    check("  it starts as a draft", r.rows[0]?.status === "draft");

    const notDraft = await probe(
      `insert into sessions (group_id, played_at, status, created_by)
       values ($1, current_date, 'approved', $2)`,
      [gid, member]
    );
    check("  and cannot be created already approved", notDraft.refused !== null,
      "it was accepted");
  });

  await asUser(other, async () => {
    const r = await probe(
      "update sessions set notes='hello' where id=$1", [sid]
    );
    check("a non-member cannot touch it", r.rowCount === 0,
      r.refused ?? `matched ${r.rowCount} rows`);
  });

  await asUser(admin, async () => {
    const r = await probe("update sessions set notes='ok' where id=$1", [sid]);
    check("any member of the group can edit a draft, not just its author",
      r.rowCount === 1, r.refused ?? `matched ${r.rowCount} rows`);
  });

  console.log("\n  Illegal jumps\n");

  await asUser(member, async () => {
    const r = await probe(SET_STATUS, ["approved", sid]);
    check("draft cannot jump straight to approved", r.refused !== null || r.rowCount === 0,
      "it was allowed");
  });

  await asUser(member, async () => {
    const r = await apply(SET_STATUS, ["submitted", sid]);
    check("a member can submit their draft", r.refused === null, r.refused ?? "");
  });

  let row = await sessionRow(sid);
  check("  submitted_by is stamped by the database", row.submitted_by === member,
    `got ${row.submitted_by}`);
  check("  submitted_at is set", row.submitted_at !== null);

  await asUser(member, async () => {
    const r = await probe("update sessions set notes='sneaky' where id=$1", [sid]);
    check("a member can no longer edit it once submitted", r.rowCount === 0,
      r.refused ?? `matched ${r.rowCount} rows`);

    const self = await probe(SET_STATUS, ["approved", sid]);
    check("and cannot approve their own log", self.rowCount === 0 || self.refused !== null,
      "they approved it themselves");
  });

  console.log("\n  The admin decides\n");

  await asUser(admin, async () => {
    const back = await apply(
      "update sessions set status='draft', review_note='Recount Dale''s stack' where id=$1",
      [sid]
    );
    check("admin can send it back with a note", back.refused === null, back.refused ?? "");
  });
  row = await sessionRow(sid);
  check("  it is a draft again", row.status === "draft");
  check("  the note survives", /Recount/.test(row.review_note ?? ""));
  check("  and the old submission stamp is cleared",
    row.submitted_by === null && row.submitted_at === null,
    "a stale stamp would misattribute the next submission");

  await asUser(member, async () => {
    await apply(SET_STATUS, ["submitted", sid]);
  });
  await asUser(admin, async () => {
    const r = await apply(SET_STATUS, ["approved", sid]);
    check("admin can approve", r.refused === null, r.refused ?? "");
  });
  row = await sessionRow(sid);
  check("  approved_by is stamped by the database", row.approved_by === admin,
    `got ${row.approved_by}`);

  await asUser(admin, async () => {
    const r = await probe("update sessions set notes='after' where id=$1", [sid]);
    check("an approved log is closed even to the admin", r.rowCount === 0,
      r.refused ?? "it was editable without reopening");

    const reopen = await apply(SET_STATUS, ["draft", sid]);
    check("  until they reopen it", reopen.refused === null, reopen.refused ?? "");
  });
  row = await sessionRow(sid);
  check("  reopening clears the approval", row.approved_by === null);

  console.log("\n  Books that do not balance cannot be approved\n");

  await client.query("update sessions set needs_review = true where id=$1", [sid]);
  await asUser(member, async () => {
    await apply(SET_STATUS, ["submitted", sid]);
  });
  await asUser(admin, async () => {
    const r = await probe(SET_STATUS, ["approved", sid]);
    check("approval is refused while needs_review is set",
      /do not balance/i.test(r.refused ?? ""),
      r.refused ?? "an unbalanced session was approved");
  });

  console.log("\n  Buy-ins follow their session's state\n");

  await client.query("update sessions set needs_review = false where id=$1", [sid]);
  await client.query(SET_STATUS, ["draft", sid]);
  const pid = (
    await client.query(
      `insert into players (group_id, name, display_name, is_guest)
       values ($1,'Guest P4','Guest P4',true) returning id`,
      [gid]
    )
  ).rows[0].id;

  await asUser(member, async () => {
    const r = await probe(
      "insert into buy_ins (session_id, player_id, amount_cents) values ($1,$2,4000)",
      [sid, pid]
    );
    check("a member can add a buy-in while the log is a draft",
      r.refused === null, r.refused ?? "");
  });

  await client.query(SET_STATUS, ["submitted", sid]);
  await asUser(member, async () => {
    const r = await probe(
      "insert into buy_ins (session_id, player_id, amount_cents) values ($1,$2,4000)",
      [sid, pid]
    );
    check("but not once it is submitted", r.refused !== null, "it was accepted");
  });
  await asUser(admin, async () => {
    const r = await probe(
      "insert into buy_ins (session_id, player_id, amount_cents) values ($1,$2,4000)",
      [sid, pid]
    );
    check("the admin still can, while reviewing", r.refused === null, r.refused ?? "");
  });

  await client.query(SET_STATUS, ["approved", sid]);
  await asUser(admin, async () => {
    const r = await probe(
      "insert into buy_ins (session_id, player_id, amount_cents) values ($1,$2,4000)",
      [sid, pid]
    );
    check("nobody can, once approved — reopen first", r.refused !== null,
      "money was written to an approved log");
  });

  console.log("\n  Deleting\n");

  await client.query(SET_STATUS, ["draft", sid]);
  await asUser(admin, async () => {
    const r = await probe("delete from sessions where id=$1", [sid]);
    check("an admin can delete a draft", r.rowCount === 1,
      r.refused ?? `matched ${r.rowCount} rows`);
  });

  let ownSid;
  await asUser(member, async () => {
    const r = await apply(
      `insert into sessions (group_id, played_at, created_by)
       values ($1, current_date, $2) returning id`,
      [gid, member]
    );
    ownSid = r.rows[0]?.id;
    const del = await probe("delete from sessions where id=$1", [ownSid]);
    check("a member can delete their OWN draft", del.rowCount === 1,
      del.refused ?? `matched ${del.rowCount} rows`);
  });

  await asUser(admin, async () => {
    await apply(
      `insert into sessions (id, group_id, played_at, created_by)
       values ($1,$2,current_date,$3)`,
      [uuid(), gid, admin]
    );
  });
  const adminDraft = (
    await client.query(
      "select id from sessions where group_id=$1 and created_by=$2 limit 1",
      [gid, admin]
    )
  ).rows[0]?.id;
  await asUser(member, async () => {
    const r = await probe("delete from sessions where id=$1", [adminDraft]);
    check("but not somebody else's", r.rowCount === 0,
      r.refused ?? `matched ${r.rowCount} rows`);
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
