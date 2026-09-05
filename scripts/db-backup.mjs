#!/usr/bin/env node
// Snapshot every row of the app's tables to JSON. Free-tier Supabase has no
// managed backups, so this is the restore path before a migration.
//
//   node scripts/db-backup.mjs            -> ./backups/<timestamp>/
//   node scripts/db-backup.mjs ./somewhere
//
// Combined with supabase/migrations/*.sql (which recreate the schema exactly),
// these files are enough to rebuild the database from nothing.
//
// Money stays as integer cents in the JSON — no floats, no formatting.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import pg from "pg";

const TABLES = [
  "players",
  "sessions",
  "buy_ins",
  "cash_outs",
  "payouts",
];

function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvLocal();
if (!process.env.SUPABASE_DB_URL) {
  console.error("SUPABASE_DB_URL is not set in .env.local");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = resolve(process.argv[2] ?? join("backups", stamp));
mkdirSync(outDir, { recursive: true });

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const manifest = { takenAt: new Date().toISOString(), tables: {} };

try {
  for (const table of TABLES) {
    const { rows } = await client.query(`select * from ${table}`);
    writeFileSync(
      join(outDir, `${table}.json`),
      JSON.stringify(rows, null, 2)
    );
    manifest.tables[table] = rows.length;
    console.log(`  ${String(rows.length).padStart(5)}  ${table}`);
  }

  // Money totals, so a restore can be checked against the source.
  const { rows: totals } = await client.query(`
    select
      (select coalesce(sum(amount_cents),0)          from buy_ins)   as buy_ins_cents,
      (select coalesce(sum(reported_amount_cents),0) from cash_outs) as reported_cents,
      (select coalesce(sum(adjusted_amount_cents),0) from cash_outs) as adjusted_cents
  `);
  manifest.moneyTotalsCents = totals[0];

  writeFileSync(
    join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  console.log(`\n  Backup written to ${outDir}`);
  console.log(`  Money totals (cents): ${JSON.stringify(totals[0])}`);
} finally {
  await client.end();
}
