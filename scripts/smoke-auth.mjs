#!/usr/bin/env node
// Google sign-in and account linking — what happens the moment a new
// identity appears.
//
//   node scripts/smoke-auth.mjs
//
// One transaction, ALWAYS rolled back. Creates its own auth users; it reads
// the twelve real accounts but never writes to them.
//
// There is no migration here. This tests a claim GROUPS.md 10b made in Phase
// 3A and nothing has exercised since: that on_auth_user_created (0009) gives
// an OAuth user a sane profile with no frontend change. The provider cannot be
// driven from a script, but the ONE thing the provider does that matters here
// is insert a row into auth.users carrying Google's metadata shape — and that
// is exactly reproducible.
//
// The failure this guards against is silent and expensive: a display_name that
// comes out blank or "Player", or a second profile for someone who already has
// one, discovered only after a real person has signed in and lost their
// history.
//
// Developer tool. Not imported by the app, not bundled.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

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

const uuid = () => crypto.randomUUID();
const tag = uuid().slice(0, 8);

/**
 * What Supabase writes to auth.users when Google returns. The metadata keys
 * are Google's: no `username`, `full_name` and `name` for the person's name.
 */
async function googleSignup(email, fullName) {
  const id = uuid();
  await client.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     values ($1, $2, $3::jsonb)`,
    [
      id,
      email,
      JSON.stringify({
        iss: "https://accounts.google.com",
        email,
        email_verified: true,
        full_name: fullName,
        name: fullName,
        avatar_url: "https://lh3.googleusercontent.com/example",
        provider_id: `1${tag}`,
      }),
    ]
  );
  await client.query(
    `insert into auth.identities (id, user_id, provider, provider_id, identity_data)
     values ($1, $2, 'google', $3, $4::jsonb)`,
    [uuid(), id, `g-${tag}-${email}`, JSON.stringify({ sub: `g-${tag}`, email })]
  );
  return id;
}

/** What the new email+password signup form produces. */
async function emailSignup(email, displayName) {
  const id = uuid();
  await client.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     values ($1, $2, $3::jsonb)`,
    [id, email, JSON.stringify({ display_name: displayName })]
  );
  await client.query(
    `insert into auth.identities (id, user_id, provider, provider_id, identity_data)
     values ($1, $2, 'email', $3, $4::jsonb)`,
    [uuid(), id, id, JSON.stringify({ sub: id, email })]
  );
  return id;
}

const profileOf = async (id) =>
  (await client.query("select * from profiles where id=$1", [id])).rows[0];

try {
  await client.connect();
  await client.query("begin");

  console.log("\n  What the trigger does with Google's metadata\n");

  const dale = await googleSignup(`dale.cooper.${tag}@gmail.com`, "Dale Cooper");
  let p = await profileOf(dale);

  check("a Google signup gets a profile at all, with no frontend involved",
    p !== undefined);
  check("  display_name comes from Google's full_name",
    p?.display_name === "Dale Cooper", `got ${JSON.stringify(p?.display_name)}`);
  check("  it is never blank or the 'Player' fallback",
    Boolean(p?.display_name?.trim()) && p?.display_name !== "Player",
    `${p?.display_name}`);
  check("  username is seeded from the email local part",
    p?.username === `dale.cooper.${tag}`, `got ${JSON.stringify(p?.username)}`);
  check("  is_app_owner defaults to false — the superadmin is not handed out",
    p?.is_app_owner === false);
  check("  and the account belongs to no group yet",
    (await client.query(
      "select count(*)::int as n from group_members where profile_id=$1", [dale]
    )).rows[0].n === 0);

  console.log("\n  A Google name that collides with a handle already taken\n");

  // "will" is a real username in this database. A Google account whose email
  // local part is "will" must NOT fail signup over a display handle.
  const clash = await googleSignup(`will@gmail-${tag}.com`, "William Other");
  p = await profileOf(clash);
  check("the account is still created", p !== undefined);
  check("  username left NULL rather than losing the signup",
    p?.username === null, `got ${JSON.stringify(p?.username)}`);
  check("  display_name still arrives intact",
    p?.display_name === "William Other", `${p?.display_name}`);
  check("  and the existing @will is untouched",
    (await client.query(
      "select count(*)::int as n from profiles where username='will'"
    )).rows[0].n === 1);

  console.log("\n  A Google account with no name at all\n");

  const anon = await googleSignup(`quiet.${tag}@gmail.com`, "");
  p = await profileOf(anon);
  check("display_name falls back rather than violating NOT NULL",
    Boolean(p?.display_name?.trim()), `got ${JSON.stringify(p?.display_name)}`);
  check("  and it is the email local part, not the literal 'Player'",
    p?.display_name === `quiet.${tag}`, `${p?.display_name}`);

  console.log("\n  The new email + password signup form\n");

  const emailUser = await emailSignup(`newbie.${tag}@example.com`, "Newbie");
  p = await profileOf(emailUser);
  check("display_name comes from what they typed",
    p?.display_name === "Newbie", `${p?.display_name}`);
  check("  username is derived, since the form no longer asks for one",
    p?.username === `newbie.${tag}`, `${p?.username}`);
  check("  the address stored is real, not @royal.gg.local",
    (await client.query("select email from auth.users where id=$1", [emailUser]))
      .rows[0].email.endsWith("@example.com"));

  console.log("\n  THE POINT: linking adds a way in, not a second account\n");

  // Exactly what supabase.auth.linkIdentity() does to the database: another
  // row in auth.identities for a user who already exists. The profile trigger
  // is on auth.users INSERT, so it must not fire again.
  const before = await client.query("select count(*)::int as n from profiles");
  const legacy = (await client.query(
    "select id, username, display_name from profiles where username='will'"
  )).rows[0];
  const groupsBefore = (await client.query(
    "select count(*)::int as n from group_members where profile_id=$1 and status='active'",
    [legacy.id]
  )).rows[0].n;

  await client.query(
    `insert into auth.identities (id, user_id, provider, provider_id, identity_data)
     values ($1, $2, 'google', $3, $4::jsonb)`,
    [uuid(), legacy.id, `link-${tag}`,
     JSON.stringify({ sub: `link-${tag}`, email: `will.z.${tag}@gmail.com` })]
  );

  const after = await client.query("select count(*)::int as n from profiles");
  check("connecting Google creates NO second profile",
    after.rows[0].n === before.rows[0].n,
    `${before.rows[0].n} -> ${after.rows[0].n}`);

  const stillThere = await profileOf(legacy.id);
  check("  the same profile, same handle, same name",
    stillThere.username === legacy.username &&
      stillThere.display_name === legacy.display_name);
  check("  and every group membership survives",
    (await client.query(
      "select count(*)::int as n from group_members where profile_id=$1 and status='active'",
      [legacy.id]
    )).rows[0].n === groupsBefore, `was ${groupsBefore}`);

  const ways = await client.query(
    "select provider from auth.identities where user_id=$1 order by provider",
    [legacy.id]
  );
  check("  the account now has two ways in",
    ways.rows.map((r) => r.provider).join(",") === "email,google",
    ways.rows.map((r) => r.provider).join(","));

  console.log("\n  The legacy twelve are unaffected\n");

  const legacyCount = await client.query(
    `select count(*)::int as n from auth.users
      where email like '%@royal.gg.local'`
  );
  check("all twelve synthetic accounts still exist",
    legacyCount.rows[0].n >= 12, `${legacyCount.rows[0].n}`);

  // 0009 added on_auth_user_created on 2026-09-06. Four accounts predate it
  // and have no profile — roadrunner, dalec, test1, test2, all dead test
  // accounts from 2026-04-28. RequireAuth already bounces them to /login, so
  // they are harmless, and deleting them is Will's call, not this test's.
  //
  // Asserting "zero orphans" would fail on them forever; asserting "exactly
  // four" would rot the moment he deletes one. So assert the rule that
  // actually matters: nothing created SINCE the trigger may be missing a
  // profile. A fifth orphan is a real bug and fails this.
  const TRIGGER_LANDED = "2026-09-06";
  const newOrphans = await client.query(
    `select u.email from auth.users u
      where u.created_at >= $1::date
        and not exists (select 1 from profiles p where p.id = u.id)`,
    [TRIGGER_LANDED]
  );
  check("every account created since the trigger has a profile",
    newOrphans.rowCount === 0,
    newOrphans.rows.map((r) => r.email).join(", "));

  const preTrigger = await client.query(
    `select count(*)::int as n from auth.users u
      where u.created_at < $1::date
        and not exists (select 1 from profiles p where p.id = u.id)`,
    [TRIGGER_LANDED]
  );
  check(`  (${preTrigger.rows[0].n} pre-trigger account(s) have none — known, and locked out by RequireAuth)`,
    true);

  const blank = await client.query(
    "select count(*)::int as n from profiles where btrim(display_name) = ''"
  );
  check("no profile anywhere has a blank display name",
    blank.rows[0].n === 0, `${blank.rows[0].n}`);

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
