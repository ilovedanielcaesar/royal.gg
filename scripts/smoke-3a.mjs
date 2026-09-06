#!/usr/bin/env node
// Phase 3A smoke test — probes WRITES, not just reads.
//
//   node scripts/smoke-3a.mjs             # against the live schema
//   node scripts/smoke-3a.mjs --rehearse  # apply 0009 in the txn first
//
// Everything runs inside ONE transaction that is ALWAYS rolled back, so this
// never leaves a row behind. --rehearse applies the migration inside that same
// transaction, which lets you watch it work before `npx supabase db push`.
//
// It exists because of 0007's lesson: that migration broke every INSERT path
// while every read kept working, and a click-through test missed it. Every
// check below is a write.
//
// Developer tool. Not imported by the app, not bundled.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const MIGRATION = "supabase/migrations/0009_auth_profiles_trigger.sql";
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

/**
 * Try an INSERT and undo it either way. Returns null if it was allowed, or
 * the error message if it was refused.
 */
async function probeInsert(sql, params) {
  await client.query("savepoint probe");
  try {
    await client.query(sql, params);
    await client.query("rollback to savepoint probe");
    return null;
  } catch (e) {
    await client.query("rollback to savepoint probe");
    return e.message;
  }
}

const uuid = () => crypto.randomUUID();

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

  const nullable = await client.query(
    `select is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'username'`
  );
  check(
    "profiles.username is nullable",
    nullable.rows[0]?.is_nullable === "YES"
  );

  const trig = await client.query(
    `select 1 from pg_trigger
      where tgname = 'on_auth_user_created'
        and tgrelid = 'auth.users'::regclass and not tgisinternal`
  );
  check("trigger on_auth_user_created exists on auth.users", trig.rowCount === 1);

  console.log("\n  Signup writes\n");

  // 1. Password signup: username + display_name arrive in user metadata.
  const pwId = uuid();
  await client.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     values ($1, $2, $3::jsonb)`,
    [
      pwId,
      "smoketest@royal.gg.local",
      JSON.stringify({ username: "smoketest", display_name: "Smoke Test" }),
    ]
  );
  const pw = await client.query(
    "select username::text, display_name, is_app_owner from profiles where id = $1",
    [pwId]
  );
  check("password signup creates a profile", pw.rowCount === 1);
  check(
    "  username carried through",
    pw.rows[0]?.username === "smoketest",
    `got ${JSON.stringify(pw.rows[0]?.username)}`
  );
  check(
    "  display_name carried through",
    pw.rows[0]?.display_name === "Smoke Test",
    `got ${JSON.stringify(pw.rows[0]?.display_name)}`
  );
  check("  not an app owner", pw.rows[0]?.is_app_owner === false);

  // The whole point of 3A: an account belongs to nothing until it joins.
  const stray = await client.query(
    "select count(*)::int as n from players where profile_id = $1",
    [pwId]
  );
  check(
    "signup creates NO players row",
    stray.rows[0].n === 0,
    `found ${stray.rows[0].n}`
  );
  const strayMember = await client.query(
    "select count(*)::int as n from group_members where profile_id = $1",
    [pwId]
  );
  check(
    "signup creates NO group membership",
    strayMember.rows[0].n === 0,
    `found ${strayMember.rows[0].n}`
  );

  // 2. OAuth shape: no username in metadata, a provider display name instead.
  const oauthId = uuid();
  await client.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     values ($1, $2, $3::jsonb)`,
    [
      oauthId,
      "ada.lovelace@gmail.com",
      JSON.stringify({
        full_name: "Ada Lovelace",
        avatar_url: "https://example.invalid/a.png",
      }),
    ]
  );
  const oauth = await client.query(
    "select username::text, display_name from profiles where id = $1",
    [oauthId]
  );
  check("OAuth-shaped signup creates a profile", oauth.rowCount === 1);
  check(
    "  username seeded from the email local part",
    oauth.rows[0]?.username === "ada.lovelace",
    `got ${JSON.stringify(oauth.rows[0]?.username)}`
  );
  check(
    "  display_name from the provider's full_name",
    oauth.rows[0]?.display_name === "Ada Lovelace",
    `got ${JSON.stringify(oauth.rows[0]?.display_name)}`
  );

  // 3. A taken handle must not cost somebody their account.
  const taken = await client.query(
    `select username::text from profiles
      where username is not null order by created_at limit 1`
  );
  const takenName = taken.rows[0]?.username;
  const clashId = uuid();
  await client.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     values ($1, $2, $3::jsonb)`,
    [clashId, `${takenName}@gmail.com`, JSON.stringify({ full_name: "Name Clash" })]
  );
  const clash = await client.query(
    "select username::text, display_name from profiles where id = $1",
    [clashId]
  );
  check(`taken handle ("${takenName}") still creates the account`, clash.rowCount === 1);
  check(
    "  username left NULL for the user to pick later",
    clash.rows[0]?.username === null,
    `got ${JSON.stringify(clash.rows[0]?.username)}`
  );

  console.log("\n  Founding a group, as the new account (RLS enforced)\n");

  const groupId = uuid();
  const suffix = clashId.slice(0, 8);
  await asUser(pwId, async () => {
    const err = await probeInsert(
      `insert into groups (id, name, slug, join_code, created_by)
       values ($1, $2, $3, $4, $5)`,
      [groupId, "Smoke Test Group", `smoke-${suffix}`, `SMOKE${suffix}`, pwId]
    );
    check("new account can create its own group", err === null, err ?? "");
  });

  // Insert it for real — the probe above rolled its savepoint back.
  await client.query(
    `insert into groups (id, name, slug, join_code, created_by)
     values ($1, $2, $3, $4, $5)`,
    [groupId, "Smoke Test Group", `smoke-${suffix}`, `SMOKE${suffix}`, pwId]
  );

  await asUser(pwId, async () => {
    const err = await probeInsert(
      `insert into group_members (group_id, profile_id, role, status)
       values ($1, $2, 'admin', 'active')`,
      [groupId, pwId]
    );
    check("founder can add themselves as that group's admin", err === null, err ?? "");
  });

  console.log("\n  Negative controls (these MUST be refused)\n");

  const royal = await client.query("select id from groups where slug = 'royal'");
  const royalId = royal.rows[0]?.id;

  await asUser(oauthId, async () => {
    const err = await probeInsert(
      `insert into group_members (group_id, profile_id, role, status)
       values ($1, $2, 'admin', 'active')`,
      [royalId, oauthId]
    );
    check(
      "stranger CANNOT make themselves admin of royal",
      err !== null,
      "the insert succeeded"
    );

    const err2 = await probeInsert(
      `insert into group_members (group_id, profile_id, role, status)
       values ($1, $2, 'member', 'active')`,
      [groupId, oauthId]
    );
    check(
      "stranger CANNOT join someone else's new group",
      err2 !== null,
      "the insert succeeded"
    );

    const err3 = await probeInsert(
      `insert into groups (name, slug, join_code, created_by)
       values ('Impostor', $1, $2, $3)`,
      [`impostor-${suffix}`, `IMP${suffix}`, pwId]
    );
    check(
      "cannot create a group owned by somebody else",
      err3 !== null,
      "the insert succeeded"
    );
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
