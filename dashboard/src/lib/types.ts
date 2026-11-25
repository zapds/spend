export type TransactionType = "debit" | "credit"

export type MetricCardData = {
  amount: number
  count: number
  deltaPercent: number | null
  deltaLabel: string
}

export type RangeSummaryData = {
  debits: number
  debitCount: number
  credits: number
  creditCount: number
  net: number
}

export type MergedCreditInfo = {
  id: number
  amount: number
  payee: string
  timestamp: string
}

export type TransactionRow = {
  id: number
  type: TransactionType
  timestamp: string
  amount: number
  payee: string
  tag: string | null
  note: string | null
  externalRef?: string | null
  mergedIntoId?: number | null
  mergedCredits?: MergedCreditInfo[]
}

export type TagOption = {
  id: number
  name: string
  description: string | null
}
