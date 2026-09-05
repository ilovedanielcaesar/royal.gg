#!/usr/bin/env node
// Read-eval loop for the remote Supabase database, for development only.
//
//   node scripts/db.mjs "select count(*) from players"
//   node scripts/db.mjs -f path/to/query.sql
//
// Reads SUPABASE_DB_URL from .env.local, which is gitignored — the connection
// string must never be passed on the command line (it would land in shell
// history) or committed.
//
// This is a developer tool. It is not imported by the app and is not bundled.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

function loadEnvLocal() {
  let raw;
  try {
    raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  } catch {
    fail("No .env.local found in the current directory.");
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, value] = m;
    if (!(key in process.env)) {
      process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  }
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

function getSql() {
  const args = process.argv.slice(2);
  if (args[0] === "-f") {
    if (!args[1]) fail("Usage: node scripts/db.mjs -f <file.sql>");
    return readFileSync(resolve(args[1]), "utf8");
  }
  if (!args.length) {
    fail('Usage: node scripts/db.mjs "<sql>"  |  node scripts/db.mjs -f <file.sql>');
  }
  return args.join(" ");
}

loadEnvLocal();

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  fail(
    "SUPABASE_DB_URL is not set in .env.local.\n" +
      "  Add it as a single line, e.g.\n" +
      "    SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@<host>:5432/postgres"
  );
}

const sql = getSql();

// Supabase requires TLS. The pooler presents a cert that doesn't chain to a
// root in Node's default store, so verification is disabled here — acceptable
// for a local dev tool, and the only reason this file isn't in src/.
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const result = await client.query(sql);
  const results = Array.isArray(result) ? result : [result];

  for (const r of results) {
    if (r.rows?.length) {
      console.table(r.rows);
      console.log(`(${r.rows.length} row${r.rows.length === 1 ? "" : "s"})`);
    } else {
      console.log(`${r.command ?? "OK"} — ${r.rowCount ?? 0} row(s) affected`);
    }
  }
} catch (e) {
  console.error(`\n  Query failed: ${e.message}`);
  if (e.hint) console.error(`  hint: ${e.hint}`);
  if (e.detail) console.error(`  detail: ${e.detail}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
