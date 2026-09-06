#!/usr/bin/env node
// Phase 3B smoke test — join codes, invite links, and the group-admin policies.
//
//   node scripts/smoke-3b.mjs             # against the live schema
//   node scripts/smoke-3b.mjs --rehearse  # apply 0010 in the txn first
//
// Everything runs inside ONE transaction that is ALWAYS rolled back. It builds
// its own throwaway accounts and groups, so it never touches royal or test1
// beyond reading them.
//
// Every join is called the way the app calls it: as the `authenticated` role
// with request.jwt.claims set, so RLS and auth.uid() are real. A test that ran
// as the owning role would prove nothing — that is the whole point.
//
// Developer tool. Not imported by the app, not bundled.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const MIGRATION = "supabase/migrations/0010_group_join.sql";
const rehearse = process.argv.includes("--rehearse");

const GREEN = "[32m";
const RED = "[31m";
const OFF = "[0m";

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

/** Run as an end user: RLS enforced, auth.uid() = profileId. */
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

/** Call join_group(). Returns { ok: payload } or { err: message }. */
async function join(code) {
  await client.query("savepoint j");
  try {
    const r = await client.query("select join_group($1) as result", [code]);
    await client.query("release savepoint j");
    return { ok: r.rows[0].result };
  } catch (e) {
    await client.query("rollback to savepoint j");
    return { err: e.message };
  }
}

/** Try a statement and undo it either way. null = allowed, message = refused. */
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

/** A throwaway account. The 0009 trigger writes the profile. */
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

/** A group owned by `ownerId`, with that owner as its active admin. */
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

async function makeInvite(groupId, { expiresAt = null, maxUses = null } = {}) {
  const token = `tok-${uuid()}`;
  await client.query(
    `insert into group_invites (group_id, token, expires_at, max_uses, used_count)
     values ($1, $2, $3, $4, 0)`,
    [groupId, token, expiresAt, maxUses]
  );
  return token;
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

  console.log("\n  Schema\n");

  const fns = await client.query(
    `select p.proname, p.prosecdef, p.provolatile
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('is_group_member','is_group_admin','join_group')
      order by p.proname`
  );
  check("all three functions exist", fns.rowCount === 3, `found ${fns.rowCount}`);
  check(
    "all three are SECURITY DEFINER",
    fns.rows.every((r) => r.prosecdef === true),
    "a plain function here recurses inside group_members policies"
  );
  check(
    "both membership helpers are STABLE",
    fns.rows
      .filter((r) => r.proname !== "join_group")
      .every((r) => r.provolatile === "s")
  );

  const pol = await client.query(
    `select count(*)::int as n from pg_policies
      where schemaname = 'public'
        and policyname in ('groups_update_group_admin','group_invites_group_admin')`
  );
  check("both group-admin policies exist", pol.rows[0].n === 2);

  // --- fixtures -------------------------------------------------------------
  const alice = await makeAccount("alice"); // founder / admin
  const bob = await makeAccount("bob"); // joiner
  const carol = await makeAccount("carol"); // second joiner
  const instant = await makeGroup("instant", "code", alice);
  const approve = await makeGroup("approve", "code_approve", alice);

  console.log("\n  Helpers\n");

  await asUser(alice, async () => {
    const r = await client.query(
      "select is_group_member($1) as m, is_group_admin($1) as a",
      [instant.id]
    );
    check("founder is a member of their group", r.rows[0].m === true);
    check("founder is an admin of their group", r.rows[0].a === true);
  });
  await asUser(bob, async () => {
    const r = await client.query(
      "select is_group_member($1) as m, is_group_admin($1) as a",
      [instant.id]
    );
    check("a stranger is neither member nor admin", r.rows[0].m === false && r.rows[0].a === false);
  });

  console.log("\n  Joining by standing code\n");

  await asUser(bob, async () => {
    const r = await join(instant.code);
    check("join_policy 'code' joins straight away", r.ok?.status === "active",
      r.err ?? JSON.stringify(r.ok));
    check("  reports the group's slug", typeof r.ok?.slug === "string" && r.ok.slug.length > 0);

    const again = await join(instant.code.toLowerCase());
    check("codes are case-insensitive and re-joining is a no-op",
      again.ok?.already_member === true && again.ok?.status === "active",
      again.err ?? JSON.stringify(again.ok));
  });

  const rows = await client.query(
    "select count(*)::int as n from group_members where group_id=$1 and profile_id=$2",
    [instant.id, bob]
  );
  check("exactly one membership row after two joins", rows.rows[0].n === 1,
    `found ${rows.rows[0].n}`);

  const roster = await client.query(
    "select count(*)::int as n from players where profile_id=$1", [bob]
  );
  check("joining creates NO players roster row (3C owns that)",
    roster.rows[0].n === 0, `found ${roster.rows[0].n}`);

  await asUser(carol, async () => {
    const r = await join(approve.code);
    check("join_policy 'code_approve' lands pending", r.ok?.status === "pending",
      r.err ?? JSON.stringify(r.ok));
  });

  await asUser(carol, async () => {
    const r = await client.query("select is_group_member($1) as m", [approve.id]);
    check("  and a pending member is not yet a member", r.rows[0].m === false);
  });

  console.log("\n  Refusals\n");

  await asUser(bob, async () => {
    const r = await join("NOPE-NOT-A-CODE");
    check("unknown code is refused", /does not match any group/i.test(r.err ?? ""),
      r.err ?? "it was accepted");

    const blank = await join("   ");
    check("blank code is refused", /enter a join code/i.test(blank.err ?? ""),
      blank.err ?? "it was accepted");
  });

  // Removed members must not be able to walk back in with the code.
  await client.query(
    "update group_members set status='removed' where group_id=$1 and profile_id=$2",
    [instant.id, bob]
  );
  await asUser(bob, async () => {
    const r = await join(instant.code);
    check("a removed member cannot re-join with the code",
      /access to this group was removed/i.test(r.err ?? ""),
      r.err ?? "they were let back in");
  });
  await client.query(
    "delete from group_members where group_id=$1 and profile_id=$2", [instant.id, bob]
  );

  console.log("\n  Invite links\n");

  const good = await makeInvite(instant.id);
  await asUser(bob, async () => {
    const r = await join(good);
    check("a valid invite token joins", r.ok?.status === "active",
      r.err ?? JSON.stringify(r.ok));
  });
  const used = await client.query(
    "select used_count from group_invites where token=$1", [good]
  );
  check("  used_count incremented", used.rows[0].used_count === 1,
    `got ${used.rows[0].used_count}`);

  const expired = await makeInvite(instant.id, {
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  });
  await asUser(carol, async () => {
    const r = await join(expired);
    check("an expired invite is refused", /expired/i.test(r.err ?? ""),
      r.err ?? "it was accepted");
  });

  const oneShot = await makeInvite(instant.id, { maxUses: 1 });
  const dave = await makeAccount("dave");
  await asUser(carol, async () => {
    const r = await join(oneShot);
    check("a max_uses=1 invite works once", r.ok?.status === "active",
      r.err ?? JSON.stringify(r.ok));
  });
  await asUser(dave, async () => {
    const r = await join(oneShot);
    check("  and is refused the second time", /used up/i.test(r.err ?? ""),
      r.err ?? "it was accepted twice");
  });

  const spentRoster = await client.query(
    "select count(*)::int as n from players where profile_id = any($1::uuid[])",
    [[bob, carol, dave]]
  );
  check("no invite join created a roster row either", spentRoster.rows[0].n === 0,
    `found ${spentRoster.rows[0].n}`);

  // An invite is a way in, not a way past the group's join policy.
  const approveInvite = await makeInvite(approve.id);
  await asUser(dave, async () => {
    const r = await join(approveInvite);
    check("an invite into a 'code_approve' group still lands pending",
      r.ok?.status === "pending", r.err ?? JSON.stringify(r.ok));
  });

  console.log("\n  Who may call join_group at all\n");

  await client.query("set local role authenticated");
  const anonymous = await join(instant.code);
  await client.query("reset role");
  check("signed in with no subject claim is refused",
    /must be signed in/i.test(anonymous.err ?? ""),
    anonymous.err ?? "it was accepted");

  await client.query("set local role anon");
  const asAnon = await join(instant.code);
  await client.query("reset role");
  check("the anon role cannot execute join_group at all",
    /permission denied/i.test(asAnon.err ?? ""),
    asAnon.err ?? "it was accepted");

  console.log("\n  Group-admin policies (RLS enforced)\n");

  const other = await makeGroup("other", "code", dave);

  await asUser(alice, async () => {
    const mine = await probe(
      "update groups set join_code=$1 where id=$2", [`ROT${tag}`, instant.id]
    );
    check("group admin can rotate their own join code",
      mine.refused === null && mine.rowCount === 1,
      mine.refused ?? `matched ${mine.rowCount} rows`);

    // RLS makes a forbidden UPDATE match zero rows rather than error.
    const theirs = await probe(
      "update groups set join_code=$1 where id=$2", [`BAD${tag}`, other.id]
    );
    check("  but not somebody else's", theirs.rowCount === 0,
      theirs.refused ?? `matched ${theirs.rowCount} rows`);

    const invite = await probe(
      `insert into group_invites (group_id, token, created_by) values ($1,$2,$3)`,
      [instant.id, `new-${uuid()}`, alice]
    );
    check("group admin can mint an invite for their group", invite.refused === null,
      invite.refused ?? "");

    const foreign = await probe(
      `insert into group_invites (group_id, token, created_by) values ($1,$2,$3)`,
      [other.id, `bad-${uuid()}`, alice]
    );
    check("  but not for a group they don't run", foreign.refused !== null,
      "the insert succeeded");
  });

  await asUser(bob, async () => {
    const r = await probe(
      `insert into group_invites (group_id, token, created_by) values ($1,$2,$3)`,
      [instant.id, `member-${uuid()}`, bob]
    );
    check("a plain member CANNOT mint an invite", r.refused !== null,
      "the insert succeeded");

    const u = await probe(
      "update groups set name='Hijacked' where id=$1", [instant.id]
    );
    check("a plain member CANNOT edit the group", u.rowCount === 0,
      u.refused ?? `matched ${u.rowCount} rows`);
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
