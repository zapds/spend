import {
  addDays,
  addMonths,
  endOfDay,
  formatISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns"

export type RangeKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "previous_month"
  | "year_to_date"
  | "custom"

export const RANGE_OPTIONS: Array<{ value: RangeKey; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This week" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "previous_month", label: "Previous month" },
  { value: "year_to_date", label: "Year to date" },
]

export function toDateInputValue(date: Date) {
  return formatISO(date, { representation: "date" })
}

export function resolveDateRange(params?: URLSearchParams) {
  const now = new Date()
  const range = (params?.get("range") as RangeKey | null) ?? "last_30_days"
  const customStart = params?.get("dateStart")
  const customEnd = params?.get("dateEnd")

  if (range === "custom" && customStart && customEnd) {
    return {
      range,
      start: startOfDay(new Date(`${customStart}T00:00:00`)),
      end: addDays(startOfDay(new Date(`${customEnd}T00:00:00`)), 1),
    }
  }

  switch (range) {
    case "today":
      return { range, start: startOfDay(now), end: now }
    case "yesterday": {
      const start = startOfDay(subDays(now, 1))
      return { range, start, end: addDays(start, 1) }
    }
    case "this_week":
      return { range, start: startOfWeek(now, { weekStartsOn: 1 }), end: now }
    case "last_7_days":
      return { range, start: subDays(now, 7), end: now }
    case "this_month":
      return { range, start: startOfMonth(now), end: now }
    case "previous_month": {
      const start = startOfMonth(subMonths(now, 1))
      return { range, start, end: startOfMonth(now) }
    }
    case "year_to_date":
      return { range, start: new Date(now.getFullYear(), 0, 1), end: now }
    case "last_30_days":
    default:
      return { range: "last_30_days" as RangeKey, start: subDays(now, 30), end: now }
  }
}

export function comparablePreviousRange(start: Date, end: Date) {
  const duration = end.getTime() - start.getTime()
  return { start: new Date(start.getTime() - duration), end: start }
}

export function previousMonthToDate(now = new Date()) {
  const start = startOfMonth(subMonths(now, 1))
  const end = addDays(start, Math.min(now.getDate() - 1, endOfDay(addMonths(start, 1)).getDate()))
  return { start, end }
}
