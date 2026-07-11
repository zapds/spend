import { dbErrorResponse, query, toNumber } from "@/lib/db"
import { payeeCreateSchema, validationError } from "@/lib/validators"

export async function GET() {
  try {
    const [known, suggestions] = await Promise.all([
      query<{ id: string; name: string; tag: string; spend_count: number; total_spend: string; last_seen: string | null }>(
        `SELECT p.id::text, p.name, t.name AS tag, COUNT(s.id)::int AS spend_count,
                COALESCE(SUM(s.amount), 0)::text AS total_spend, MAX(s.timestamp)::text AS last_seen
         FROM payees p
         JOIN tags t ON t.id = p.tag_id
         LEFT JOIN spends s ON s.payee = p.name
         GROUP BY p.id, p.name, t.name
         ORDER BY p.name`
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
      rows: known.rows.map((row) => ({
        ...row,
        id: Number(row.id),
        totalSpend: toNumber(row.total_spend),
        total_spend: undefined,
      })),
      suggestions: suggestions.rows.map((row) => ({
        ...row,
        totalSpend: toNumber(row.total_spend),
        total_spend: undefined,
      })),
    })
  } catch (error) {
    return dbErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const parsed = payeeCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)

  try {
    const tagResult = await query<{ id: number }>("SELECT id FROM tags WHERE name = $1", [parsed.data.tag])
    if (!tagResult.rows[0]) return Response.json({ error: "Unknown tag" }, { status: 400 })

    const result = await query<{ id: string }>(
      "INSERT INTO payees (name, tag_id) VALUES ($1, $2) RETURNING id::text",
      [parsed.data.name, tagResult.rows[0].id]
    )

    return Response.json({ ok: true, id: Number(result.rows[0]?.id) }, { status: 201 })
  } catch (error) {
    return dbErrorResponse(error)
  }
}
