export type MetricCardData = {
  amount: number
  count: number
  deltaPercent: number | null
  deltaLabel: string
}

export type TransactionRow = {
  id: number
  timestamp: string
  amount: number
  payee: string
  tag: string | null
  note: string | null
}

export type TagOption = {
  id: number
  name: string
  description: string | null
}
