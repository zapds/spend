import type { TransactionType } from "@/lib/types"

export function computeDedupeKey(
  type: TransactionType,
  timestamp: Date,
  amount: string | number,
  payee: string
) {
  const minute = `${timestamp.toISOString().slice(0, 16)}Z`
  const formattedAmount = Number(amount).toFixed(2)
  const normPayee = payee.trim().toLowerCase()
  return `${type}|${minute}|${formattedAmount}|${normPayee}`
}
