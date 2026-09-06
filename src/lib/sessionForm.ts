import type { Database } from "../types/database";

export type SessionFormPlayer =
  Database["public"]["Tables"]["players"]["Row"];
export type SessionFormSession =
  Database["public"]["Tables"]["sessions"]["Row"];

export type SessionFormRow = {
  playerId: string;
  buyInCount: string;
  cashOut: string;
};

export function parseDraftCents(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function parseCount(raw: string): number {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
