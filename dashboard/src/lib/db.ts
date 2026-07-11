import "server-only"

import { Pool, type QueryResultRow } from "pg"

let pool: Pool | null = null

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured")
  }

  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }

  return pool
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values)
}

export function toNumber(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

export function dbErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message === "DATABASE_URL is not configured"
    ? "DATABASE_URL is not configured"
    : "Database query failed"

  return Response.json({ error: message }, { status: 500 })
}
