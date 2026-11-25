import { resolveDateRange } from "@/lib/date-ranges"
import { computeDedupeKey } from "@/lib/dedupe"
import { dbErrorResponse, query, toNumber } from "@/lib/db"
import type { MergedCreditInfo, TransactionType } from "@/lib/types"
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
    const skipDateRange = url.searchParams.get("allTime") === "true"
    const values: unknown[] = []
    const where: string[] = []

    const includeMerged = url.searchParams.get("includeMerged") === "true"
    if (!includeMerged) {
      where.push("s.merged_into_id IS NULL")
    }

    if (!skipDateRange) {
      const selected = resolveDateRange(url.searchParams)
      values.push(selected.start, selected.end)
      where.push(`s.timestamp >= $${values.length - 1}`, `s.timestamp < $${values.length}`)
    }

    const type = url.searchParams.get("type")
    const tag = url.searchParams.get("tag")
    const payee = url.searchParams.get("payee")
    const amountMin = url.searchParams.get("amountMin")
    const amountMax = url.searchParams.get("amountMax")
    const tagged = url.searchParams.get("tagged") ?? "all"

    if (type === "debit" || type === "credit") {
      values.push(type)
      where.push(`s.type = $${values.length}`)
    }
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
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""
    const countValues = [...values]
    values.push(limit, offset)

    const [rows, total] = await Promise.all([
      query<{
        id: string
        type: TransactionType
        timestamp: string
        amount: string
        payee: string
        note: string | null
        tag: string | null
        external_ref: string | null
        merged_into_id: string | null
        merged_credits: Array<{ id: number; amount: number; payee: string; timestamp: string }> | null
      }>(
        `SELECT s.id::text,
                s.type,
                s.timestamp::text,
                s.amount::text,
                s.payee,
                s.note,
                t.name AS tag,
                s.external_ref,
                s.merged_into_id::text,
                COALESCE(
                  (
                    SELECT json_agg(
                      json_build_object(
                        'id', mc.id,
                        'amount', mc.amount::float8,
                        'payee', mc.payee,
                        'timestamp', mc.timestamp::text
                      ) ORDER BY mc.timestamp DESC
                    )
                    FROM spends mc
                    WHERE mc.merged_into_id = s.id
                  ),
                  '[]'::json
                ) AS merged_credits
         FROM spends s LEFT JOIN tags t ON t.id = s.tag_id
         ${whereSql}
         ORDER BY ${sortColumns[sort] ?? sortColumns.date} ${dir} NULLS LAST, s.id DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
      ),
      query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM spends s LEFT JOIN tags t ON t.id = s.tag_id ${whereSql}`,
        countValues
      ),
    ])

    return Response.json({
      rows: rows.rows.map((row) => ({
        id: Number(row.id),
        type: row.type,
        timestamp: row.timestamp,
        amount: toNumber(row.amount),
        payee: row.payee,
        note: row.note,
        tag: row.tag,
        externalRef: row.external_ref,
        mergedIntoId: row.merged_into_id ? Number(row.merged_into_id) : null,
        mergedCredits: (row.merged_credits ?? []) as MergedCreditInfo[],
      })),
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
    const { amount, payee, type, tag, timestamp, note, externalRef, allowDuplicate } = parsed.data
    const txTime = timestamp ? new Date(timestamp) : new Date()
    const dedupeKey = allowDuplicate ? null : computeDedupeKey(type, txTime, amount, payee)

    if (!allowDuplicate) {
      if (externalRef) {
        const dupRef = await query<{ id: string }>(
          "SELECT id::text FROM spends WHERE external_ref = $1 LIMIT 1",
          [externalRef]
        )
        if (dupRef.rows[0]) {
          return Response.json(
            { error: "Duplicate transaction (matching reference)", duplicate: true, existingId: Number(dupRef.rows[0].id) },
            { status: 409 }
          )
        }
      }
      if (dedupeKey) {
        const dupKey = await query<{ id: string }>(
          "SELECT id::text FROM spends WHERE dedupe_key = $1 LIMIT 1",
          [dedupeKey]
        )
        if (dupKey.rows[0]) {
          return Response.json(
            { error: "Duplicate transaction detected", duplicate: true, existingId: Number(dupKey.rows[0].id) },
            { status: 409 }
          )
        }
      }
    }

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
      `INSERT INTO spends (timestamp, amount, payee, note, tag_id, type, external_ref, dedupe_key)
       VALUES ($1::timestamptz, $2::numeric, $3, NULLIF($4, ''), $5, $6, $7, $8)
       RETURNING id::text`,
      [txTime.toISOString(), amount, payee, note ?? null, tagId, type, externalRef ?? null, dedupeKey]
    )

    return Response.json({ ok: true, id: Number(result.rows[0]?.id) }, { status: 201 })
  } catch (error) {
    return dbErrorResponse(error)
  }
}
