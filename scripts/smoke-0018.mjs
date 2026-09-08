#!/usr/bin/env node
// Phase 5C, decisions 12 and 14 — guest linking.
//
//   node scripts/smoke-0018.mjs             # against the live schema
//   node scripts/smoke-0018.mjs --rehearse  # apply 0018 in the txn first
//
// One transaction, ALWAYS rolled back. Builds its own group, accounts, guests
// and a night of poker; it reads royal's money totals but never writes to them.
//
// Every check runs as the `authenticated` role with real JWT claims. As the
// owning role RLS is bypassed and auth.uid() comes out NULL, so the whole file
// would pass while proving nothing.
//
// What this is really testing: that a person whose name a guest row already
// holds can (a) reach the pending queue at all and (b) come out the other side
// as that same row. Linking is a pure relabelling. The row keeps its name, its id and every buy-in and
// cash-out attached to it, and the subsequent approval ADOPTS the row instead
// of inserting a second one. The failure this prevents is a person's entire
// record silently splitting in two.
//
// Developer tool. Not imported by the app, not bundled.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const MIGRATION = "supabase/migrations/0018_guest_linking.sql";
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

const playerRow = async (id) =>
  (await client.query("select * from players where id=$1", [id])).rows[0];

const rosterCount = async (gid) =>
  (await client.query(
    "select count(*)::int as n from players where group_id=$1", [gid]
  )).rows[0].n;

/**
 * Royal's money, as three numbers. Snapshotted before this run creates
 * anything and compared at the end. A hardcoded total goes stale the next time
 * a night is logged, and a stale total fails for the wrong reason.
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

  if (rehearse) {
    await client.query(
      readFileSync(resolve(MIGRATION), "utf8")
        .replace(/^\s*begin\s*;/im, "")
        .replace(/^\s*commit\s*;/im, "")
    );
    console.log(`\n  Rehearsing ${MIGRATION} inside the transaction.`);
  }

  // Without this every check below fails on a missing trigger, which reads
  // like a broken test rather than a migration that has not been pushed.
  const installed = await client.query(
    `select tgenabled from pg_trigger
      where tgname='players_guard_profile_link'
        and tgrelid='players'::regclass and not tgisinternal`
  );
  if (installed.rowCount === 0) {
    console.log(
      `\n  ${RED}0018 is not applied.${OFF}\n\n` +
      `  Rehearse it first:  node scripts/smoke-0018.mjs --rehearse\n` +
      `  Then Will pushes:   npx supabase db push\n`
    );
    await client.query("rollback");
    await client.end();
    process.exit(1);
  }

  console.log("\n  Schema\n");

  check("the guard trigger is enabled, not merely present",
    installed.rows[0].tgenabled === "O",
    `tgenabled = ${installed.rows[0].tgenabled}`);

  const fn = await client.query(
    `select p.prosecdef, p.proconfig
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='guard_player_profile_link'`
  );
  check("guard_player_profile_link() exists", fn.rowCount === 1);
  check("  it is security definer — it must see rows RLS hides from the admin",
    fn.rows[0]?.prosecdef === true);
  check("  with a pinned search_path",
    (fn.rows[0]?.proconfig ?? []).some((c) => c.startsWith("search_path=")));

  const drifted = await client.query(
    `select count(*)::int as n from players
      where profile_id is not null
        and (is_guest or user_id is distinct from profile_id)`
  );
  check("every already-linked row in the live data agrees with itself",
    drifted.rows[0].n === 0, `${drifted.rows[0].n} disagree`);

  const royalBefore = await royalMoney();

  // --- fixtures -------------------------------------------------------------
  //
  // "Dale" has been a guest here for months. dale the account is the person,
  // who has just asked to join and is sitting in the pending queue.
  const admin    = await makeAccount("admin", "Admin");
  const dale     = await makeAccount("dale", "Dale");
  const stranger = await makeAccount("stranger", "Stranger");
  const seated   = await makeAccount("seated", "Seated");
  const departed = await makeAccount("departed", "Departed");

  const gid = uuid();
  await client.query(
    `insert into groups (id, name, slug, join_code, join_policy, created_by)
     values ($1,'Linking',$2,$3,'code_approve',$4)`,
    [gid, `linking-${tag}`, `L18${tag}`, admin]
  );
  await client.query(
    `insert into group_members (group_id, profile_id, role, status) values
       ($1,$2,'admin','active'),
       ($1,$3,'member','pending'),
       ($1,$4,'member','active'),
       ($1,$5,'member','left')`,
    [gid, admin, dale, seated, departed]
  );

  // The admin and "Seated" got roster rows from the activation trigger.
  // Dale the guest is added by hand, the way AddGuestForm does it.
  const guest = (await client.query(
    `insert into players (group_id, name, is_guest, status)
     values ($1,'Dale',true,'active') returning id`, [gid]
  )).rows[0].id;

  // A night of poker on Dale's guest row, so "the history stays" is a claim
  // with something behind it.
  const night = (await client.query(
    `insert into sessions (group_id, played_at) values ($1, current_date)
     returning id`, [gid]
  )).rows[0].id;
  await client.query(
    `insert into buy_ins (session_id, player_id, amount_cents)
     values ($1,$2,4000), ($1,$2,4000)`, [night, guest]
  );
  await client.query(
    `insert into cash_outs (session_id, player_id,
                            reported_amount_cents, adjusted_amount_cents)
     values ($1,$2,11000,11000)`, [night, guest]
  );

  const rosterBefore = await rosterCount(gid);

  console.log("\n  Dale can reach the pending queue at all\n");

  // The fixture above wrote Dale's membership by hand. This is the real door,
  // and until 0018 it was shut: 0013 refused any joiner whose name a roster
  // row already held, so no pending request ever existed for an admin to link
  // against, and decision 14 could not happen.
  const approveGid = uuid();
  const approveCode = `A18${tag}`;
  await client.query(
    `insert into groups (id, name, slug, join_code, join_policy, created_by)
     values ($1,'Approve',$2,$3,'code_approve',$4)`,
    [approveGid, `approve-${tag}`, approveCode, admin]
  );
  await client.query(
    `insert into group_members (group_id, profile_id, role, status)
     values ($1,$2,'admin','active')`, [approveGid, admin]
  );
  await client.query(
    `insert into players (group_id, name, is_guest, status)
     values ($1,'Dale',true,'active')`, [approveGid]
  );

  await asUser(dale, async () => {
    const r = await apply("select join_group($1) as r", [approveCode]);
    check("a code_approve group takes the request despite the clashing name",
      r.rows[0]?.r?.status === "pending",
      r.refused ?? `status ${r.rows[0]?.r?.status}`);
  });

  // Under 'code' the join is instantly active and the roster row is created in
  // the same breath, so there is no moment for an admin to link. That door
  // stays shut on purpose.
  const instantGid = uuid();
  const instantCode = `I18${tag}`;
  await client.query(
    `insert into groups (id, name, slug, join_code, join_policy, created_by)
     values ($1,'Instant',$2,$3,'code',$4)`,
    [instantGid, `instant-${tag}`, instantCode, admin]
  );
  await client.query(
    `insert into group_members (group_id, profile_id, role, status)
     values ($1,$2,'admin','active')`, [instantGid, admin]
  );
  await client.query(
    `insert into players (group_id, name, is_guest, status)
     values ($1,'Dale',true,'active')`, [instantGid]
  );

  await asUser(dale, async () => {
    const r = await probe("select join_group($1) as r", [instantCode]);
    check("  a code group still refuses at the door — nobody could link in time",
      /already goes by/i.test(r.refused ?? ""), r.refused ?? "it was allowed");
  });

  console.log("\n  Approving without linking is still refused\n");

  const clash = await probe(
    "select ensure_group_roster_row($1,$2)", [gid, dale]
  );
  check("the backstop holds — the name is taken",
    clash.refused !== null && /already taken/i.test(clash.refused ?? ""),
    clash.refused ?? "it was allowed");
  check("  and it now offers linking, not just a rename",
    /link it to their account/i.test(clash.refused ?? ""),
    clash.refused ?? "");

  console.log("\n  What an admin may not link to\n");

  await asUser(admin, async () => {
    const nomember = await probe(
      "update players set profile_id=$1 where id=$2", [stranger, guest]
    );
    check("an account with no membership here",
      /not part of this group/i.test(nomember.refused ?? ""),
      nomember.refused ?? "it was allowed");

    const gone = await probe(
      "update players set profile_id=$1 where id=$2", [departed, guest]
    );
    check("an account that has left",
      /no longer in this group/i.test(gone.refused ?? ""),
      gone.refused ?? "it was allowed");

    const twice = await probe(
      "update players set profile_id=$1 where id=$2", [seated, guest]
    );
    check("an account that already holds a card here — named, not a raw 23505",
      /already plays here as "Seated"/i.test(twice.refused ?? ""),
      twice.refused ?? "it was allowed");
    check("  and the message is not the unique index talking",
      !/duplicate key|players_group_profile_unique/i.test(twice.refused ?? ""),
      twice.refused ?? "");
  });

  await asUser(seated, async () => {
    const meddle = await probe(
      "update players set profile_id=$1 where id=$2", [seated, guest]
    );
    check("an ordinary member cannot link at all — RLS refuses before the guard",
      meddle.refused !== null || meddle.rowCount === 0,
      "the update went through");
  });

  console.log("\n  THE POINT: linking is a relabelling, not a move\n");

  await asUser(admin, async () => {
    const r = await apply(
      "update players set profile_id=$1 where id=$2", [dale, guest]
    );
    check("the admin links Dale's card to Dale's account",
      r.rowCount === 1, r.refused ?? "");
  });

  let row = await playerRow(guest);
  check("  the row keeps its id, so nothing had to move", row.id === guest);
  check("  and its name — the group still knows him as Dale",
    row.name === "Dale", row.name);
  check("  is_guest flipped, derived by the trigger", row.is_guest === false);
  check("  user_id follows profile_id, the invariant the app still reads",
    row.user_id === dale, `${row.user_id}`);
  check("  username came from the profile, not the caller",
    row.username === `dale-${tag}`, `${row.username}`);

  const money = await client.query(
    `select (select coalesce(sum(amount_cents),0)
               from buy_ins   where player_id=$1)::int as bi,
            (select coalesce(sum(adjusted_amount_cents),0)
               from cash_outs where player_id=$1)::int as co`,
    [guest]
  );
  check("  every buy-in is still his", money.rows[0].bi === 8000, `${money.rows[0].bi}`);
  check("  and the cash-out", money.rows[0].co === 11000, `${money.rows[0].co}`);

  console.log("\n  The join then ADOPTS the row\n");

  const adopted = await apply(
    "select ensure_group_roster_row($1,$2) as id", [gid, dale]
  );
  check("approval no longer raises — the clash is gone",
    adopted.refused === null, adopted.refused ?? "");
  check("  and it returns the guest row, not a new one",
    adopted.rows[0]?.id === guest, `${adopted.rows[0]?.id}`);

  await asUser(admin, async () => {
    const r = await apply(
      `update group_members set status='active'
        where group_id=$1 and profile_id=$2`, [gid, dale]
    );
    check("the admin approves Dale for real", r.rowCount === 1, r.refused ?? "");
  });

  const rosterAfter = await rosterCount(gid);
  check("  no second Dale appeared on the roster",
    rosterAfter === rosterBefore, `roster went ${rosterBefore} -> ${rosterAfter}`);

  const dales = await client.query(
    `select count(*)::int as n from players
      where group_id=$1 and lower(name)='dale'`, [gid]
  );
  check("  exactly one row is called Dale", dales.rows[0].n === 1);

  console.log("\n  Unlinking: undoable by mistake, not once they are seated\n");

  await asUser(admin, async () => {
    const active = await probe(
      "update players set profile_id=null where id=$1", [guest]
    );
    check("Dale is active now, so his card cannot be detached",
      /active member and cannot be unlinked/i.test(active.refused ?? ""),
      active.refused ?? "it was allowed");
  });

  // A second guest, linked to a still-pending account: the mis-click window.
  const oops = (await client.query(
    `insert into players (group_id, name, is_guest, status)
     values ($1,'Oops',true,'active') returning id`, [gid]
  )).rows[0].id;
  const waiting = await makeAccount("waiting", "Waiting");
  await client.query(
    `insert into group_members (group_id, profile_id, role, status)
     values ($1,$2,'member','pending')`, [gid, waiting]
  );

  await asUser(admin, async () => {
    await apply("update players set profile_id=$1 where id=$2", [waiting, oops]);
    const undo = await apply(
      "update players set profile_id=null where id=$1", [oops]
    );
    check("a link to someone still pending can be undone",
      undo.rowCount === 1, undo.refused ?? "");
  });

  row = await playerRow(oops);
  check("  and the row goes back to being a plain guest",
    row.is_guest === true && row.user_id === null && row.username === null,
    `is_guest=${row.is_guest} user_id=${row.user_id} username=${row.username}`);

  console.log("\n  The guard stays out of everything else\n");

  await asUser(dale, async () => {
    const card = await apply(
      "update players set chosen_suit='heart', chosen_rank='Q' where id=$1",
      [guest]
    );
    check("Dale can still pick his card", card.rowCount === 1, card.refused ?? "");

    const steal = await probe(
      "update players set profile_id=null where id=$1", [guest]
    );
    check("  but cannot disown his own row",
      steal.refused !== null || steal.rowCount === 0, "the update went through");
  });

  await asUser(admin, async () => {
    const rename = await apply(
      "update players set name='Dale C' where id=$1", [guest]
    );
    check("an admin can still rename a card", rename.rowCount === 1,
      rename.refused ?? "");
  });

  console.log("\n  Royal's money is where it was\n");

  const royalAfter = await royalMoney();
  check("royal's buy-ins are untouched by this run",
    royalAfter.bi === royalBefore.bi, `${royalBefore.bi} -> ${royalAfter.bi}`);
  check("royal's reported cash-outs are untouched by this run",
    royalAfter.reported === royalBefore.reported,
    `${royalBefore.reported} -> ${royalAfter.reported}`);
  check("royal's adjusted cash-outs are untouched by this run",
    royalAfter.adjusted === royalBefore.adjusted,
    `${royalBefore.adjusted} -> ${royalAfter.adjusted}`);

} catch (e) {
  failed++;
  console.error(`\n  ${RED}THREW${OFF}  ${e.message}\n`);
} finally {
  try {
    await client.query("rollback");
  } catch { /* the connection may already be gone */ }
  await client.end();
}

console.log(
  `\n  ${passed + failed} checks — ${GREEN}${passed} passed${OFF}` +
  (failed ? `, ${RED}${failed} failed${OFF}` : "") + "\n"
);
process.exit(failed ? 1 : 0);
