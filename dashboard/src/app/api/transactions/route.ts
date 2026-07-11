import { resolveDateRange } from "@/lib/date-ranges"
import { dbErrorResponse, query, toNumber } from "@/lib/db"
import { spendCreateSchema, validationError } from "@/lib/validators"

const sortColumns = {
  date: "s.timestamp",
  amount: "s.amount",
  payee: "s.payee",
  tag: "t.name",
} as const

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const selected = resolveDateRange(url.searchParams)
    const values: unknown[] = [selected.start, selected.end]
    const where = ["s.timestamp >= $1", "s.timestamp < $2"]

    const tag = url.searchParams.get("tag")
    const payee = url.searchParams.get("payee")
    const amountMin = url.searchParams.get("amountMin")
    const amountMax = url.searchParams.get("amountMax")
    const tagged = url.searchParams.get("tagged") ?? "all"

    if (tag) {
      values.push(tag)
      where.push(`t.name = $${values.length}`)
    }
    if (payee) {
      values.push(`%${payee}%`)
      where.push(`s.payee ILIKE $${values.length}`)
    }
    if (amountMin) {
      values.push(amountMin)
      where.push(`s.amount >= $${values.length}::numeric`)
    }
    if (amountMax) {
      values.push(amountMax)
      where.push(`s.amount <= $${values.length}::numeric`)
    }
    if (tagged === "tagged") where.push("s.tag_id IS NOT NULL")
    if (tagged === "untagged") where.push("s.tag_id IS NULL")

    const sort = (url.searchParams.get("sort") ?? "date") as keyof typeof sortColumns
    const dir = url.searchParams.get("dir") === "asc" ? "ASC" : "DESC"
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 25), 100)
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0)
    const whereSql = where.join(" AND ")
    const countValues = [...values]
    values.push(limit, offset)

    const [rows, total] = await Promise.all([
      query<{ id: string; timestamp: string; amount: string; payee: string; note: string | null; tag: string | null }>(
        `SELECT s.id::text, s.timestamp::text, s.amount::text, s.payee, s.note, t.name AS tag
         FROM spends s LEFT JOIN tags t ON t.id = s.tag_id
         WHERE ${whereSql}
         ORDER BY ${sortColumns[sort] ?? sortColumns.date} ${dir} NULLS LAST
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
      ),
      query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM spends s LEFT JOIN tags t ON t.id = s.tag_id WHERE ${whereSql}`,
        countValues
      ),
    ])

    return Response.json({
      rows: rows.rows.map((row) => ({ ...row, id: Number(row.id), amount: toNumber(row.amount) })),
      total: total.rows[0]?.total ?? 0,
    })
  } catch (error) {
    return dbErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const parsed = spendCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)

  try {
    const { amount, payee, tag, timestamp, note } = parsed.data
    let tagId: number | null = null
    if (tag) {
      const tagResult = await query<{ id: number }>("SELECT id FROM tags WHERE name = $1", [tag])
      if (!tagResult.rows[0]) return Response.json({ error: "Unknown tag" }, { status: 400 })
      tagId = tagResult.rows[0].id
    } else {
      const payeeResult = await query<{ tag_id: number }>("SELECT tag_id FROM payees WHERE name = $1", [payee])
      tagId = payeeResult.rows[0]?.tag_id ?? null
    }

    const result = await query<{ id: string }>(
      `INSERT INTO spends (timestamp, amount, payee, note, tag_id)
       VALUES (COALESCE($1::timestamptz, NOW()), $2::numeric, $3, NULLIF($4, ''), $5)
       RETURNING id::text`,
      [timestamp ?? null, amount, payee, note ?? null, tagId]
    )

    return Response.json({ ok: true, id: Number(result.rows[0]?.id) }, { status: 201 })
  } catch (error) {
    return dbErrorResponse(error)
  }
}
