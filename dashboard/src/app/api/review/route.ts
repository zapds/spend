import { dbErrorResponse, query, toNumber } from "@/lib/db"

function mapSpend(row: { id: string; timestamp: string; amount: string; payee: string; tag: string | null; note: string | null; default_tag?: string | null }) {
  return { ...row, id: Number(row.id), amount: toNumber(row.amount) }
}

export async function GET() {
  try {
    const [last, untagged, missingNotes, unknownPayees] = await Promise.all([
      query<{ id: string; timestamp: string; amount: string; payee: string; note: string | null; tag: string | null; default_tag: string | null }>(
        `SELECT s.id::text, s.timestamp::text, s.amount::text, s.payee, s.note, t.name AS tag, pt.name AS default_tag
         FROM spends s
         LEFT JOIN tags t ON t.id = s.tag_id
         LEFT JOIN payees p ON p.name = s.payee
         LEFT JOIN tags pt ON pt.id = p.tag_id
         ORDER BY s.timestamp DESC
         LIMIT 10`
      ),
      query<{ id: string; timestamp: string; amount: string; payee: string; note: string | null; tag: string | null; default_tag: string | null }>(
        `SELECT s.id::text, s.timestamp::text, s.amount::text, s.payee, s.note, t.name AS tag, pt.name AS default_tag
         FROM spends s
         LEFT JOIN tags t ON t.id = s.tag_id
         LEFT JOIN payees p ON p.name = s.payee
         LEFT JOIN tags pt ON pt.id = p.tag_id
         WHERE s.tag_id IS NULL
         ORDER BY s.timestamp DESC
         LIMIT 25`
      ),
      query<{ id: string; timestamp: string; amount: string; payee: string; note: string | null; tag: string | null; default_tag: string | null }>(
        `SELECT s.id::text, s.timestamp::text, s.amount::text, s.payee, s.note, t.name AS tag, pt.name AS default_tag
         FROM spends s
         LEFT JOIN tags t ON t.id = s.tag_id
         LEFT JOIN payees p ON p.name = s.payee
         LEFT JOIN tags pt ON pt.id = p.tag_id
         WHERE s.note IS NULL OR btrim(s.note) = ''
         ORDER BY s.timestamp DESC
         LIMIT 25`
      ),
      query<{ payee: string; spend_count: number; total_spend: string; last_seen: string | null }>(
        `SELECT s.payee, COUNT(*)::int AS spend_count, SUM(s.amount)::text AS total_spend, MAX(s.timestamp)::text AS last_seen
         FROM spends s
         LEFT JOIN payees p ON p.name = s.payee
         WHERE p.id IS NULL
         GROUP BY s.payee
         ORDER BY COUNT(*) DESC, SUM(s.amount) DESC
         LIMIT 10`
      ),
    ])

    return Response.json({
      last: last.rows.map(mapSpend),
      untagged: untagged.rows.map(mapSpend),
      missingNotes: missingNotes.rows.map(mapSpend),
      unknownPayees: unknownPayees.rows.map((row) => ({ ...row, totalSpend: toNumber(row.total_spend), total_spend: undefined })),
    })
  } catch (error) {
    return dbErrorResponse(error)
  }
}
