import { eachDayOfInterval, formatISO, startOfDay } from "date-fns"

import { comparablePreviousRange, resolveDateRange } from "@/lib/date-ranges"
import { dbErrorResponse, query, toNumber } from "@/lib/db"

async function metric(start: Date, end: Date, label: string) {
  const previous = comparablePreviousRange(start, end)
  const [currentResult, previousResult] = await Promise.all([
    query<{ amount: string; count: number }>(
      "SELECT COALESCE(SUM(amount), 0)::text AS amount, COUNT(*)::int AS count FROM spends WHERE timestamp >= $1 AND timestamp < $2",
      [start, end]
    ),
    query<{ amount: string }>(
      "SELECT COALESCE(SUM(amount), 0)::text AS amount FROM spends WHERE timestamp >= $1 AND timestamp < $2",
      [previous.start, previous.end]
    ),
  ])
  const amount = toNumber(currentResult.rows[0]?.amount)
  const previousAmount = toNumber(previousResult.rows[0]?.amount)
  return {
    amount,
    count: currentResult.rows[0]?.count ?? 0,
    deltaPercent: previousAmount > 0 ? ((amount - previousAmount) / previousAmount) * 100 : null,
    deltaLabel: label,
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const selected = resolveDateRange(url.searchParams)
    const now = new Date()
    const todayStart = startOfDay(now)
    const weekStart = new Date(todayStart)
    weekStart.setDate(todayStart.getDate() - ((todayStart.getDay() + 6) % 7))
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const tag = url.searchParams.get("tag")
    const payee = url.searchParams.get("payee")

    const where = ["s.timestamp >= $1", "s.timestamp < $2"]
    const values: unknown[] = [selected.start, selected.end]
    if (tag) {
      values.push(tag)
      where.push(`t.name = $${values.length}`)
    }
    if (payee) {
      values.push(`%${payee}%`)
      where.push(`s.payee ILIKE $${values.length}`)
    }
    const whereSql = where.join(" AND ")

    const [today, week, month, tagBars, payeeBars, trendRows] = await Promise.all([
      metric(todayStart, now, "vs previous elapsed day"),
      metric(weekStart, now, "vs previous elapsed week"),
      metric(monthStart, now, "vs previous elapsed month"),
      query<{ tag: string; amount: string; count: number }>(
        `SELECT COALESCE(t.name, 'Untagged') AS tag, SUM(s.amount)::text AS amount, COUNT(*)::int AS count
         FROM spends s LEFT JOIN tags t ON t.id = s.tag_id
         WHERE ${whereSql}
         GROUP BY tag
         ORDER BY SUM(s.amount) DESC
         LIMIT 12`,
        values
      ),
      query<{ payee: string; amount: string; count: number }>(
        `SELECT s.payee, SUM(s.amount)::text AS amount, COUNT(*)::int AS count
         FROM spends s LEFT JOIN tags t ON t.id = s.tag_id
         WHERE ${whereSql}
         GROUP BY s.payee
         ORDER BY SUM(s.amount) DESC
         LIMIT 12`,
        values
      ),
      query<{ date: string; tag: string; amount: string }>(
        `SELECT date_trunc('day', s.timestamp)::date::text AS date, COALESCE(t.name, 'Untagged') AS tag, SUM(s.amount)::text AS amount
         FROM spends s LEFT JOIN tags t ON t.id = s.tag_id
         WHERE ${whereSql}
         GROUP BY date, tag
         ORDER BY date ASC`,
        values
      ),
    ])

    const topTags = tagBars.rows.slice(0, 5).map((row) => row.tag)
    const trendMap = new Map<string, Record<string, number | string>>()
    for (const day of eachDayOfInterval({ start: selected.start, end: selected.end })) {
      const key = formatISO(day, { representation: "date" })
      trendMap.set(key, {
        date: key,
        ...Object.fromEntries(topTags.map((tagName) => [tagName, 0])),
      })
    }
    for (const row of trendRows.rows) {
      const tagName = topTags.includes(row.tag) ? row.tag : "Other"
      const item = trendMap.get(row.date) ?? { date: row.date }
      item[tagName] = toNumber(item[tagName]) + toNumber(row.amount)
      trendMap.set(row.date, item)
    }

    return Response.json({
      kpis: { today, week, month },
      tagBars: tagBars.rows.map((row) => ({ ...row, amount: toNumber(row.amount) })),
      payeeBars: payeeBars.rows.map((row) => ({ ...row, amount: toNumber(row.amount) })),
      tagTrend: Array.from(trendMap.values()),
      trendKeys: topTags,
      range: {
        start: selected.start.toISOString(),
        end: selected.end.toISOString(),
      },
    })
  } catch (error) {
    return dbErrorResponse(error)
  }
}
