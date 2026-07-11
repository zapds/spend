export function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0)
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
  }).format(new Date(value))
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "No comparison"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}
