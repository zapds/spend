"use client"

import * as React from "react"
import { ArrowRight, GitMerge } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { formatDateTime, formatMoney } from "@/lib/format"
import type { TransactionRow } from "@/lib/types"
import { cn } from "@/lib/utils"

export function MergeCreditDialog({
  credit,
  onClose,
  onMerged,
}: {
  credit: TransactionRow
  onClose: () => void
  onMerged?: () => void
}) {
  const [search, setSearch] = React.useState("")
  const [debits, setDebits] = React.useState<TransactionRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedDebitId, setSelectedDebitId] = React.useState<number | null>(null)
  const [merging, setMerging] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      const params = new URLSearchParams({
        type: "debit",
        allTime: "true",
        limit: "30",
        sort: "date",
        dir: "desc",
      })
      if (search.trim()) params.set("payee", search.trim())
      const response = await fetch(`/api/transactions?${params.toString()}`)
      const body = await response.json().catch(() => ({ rows: [] }))
      if (cancelled) return
      if (!response.ok) {
        toast.error(body.error ?? "Could not load debit transactions")
      } else {
        setDebits(body.rows ?? [])
      }
      setLoading(false)
    }, 150)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [search])

  const selectedDebit = debits.find((d) => d.id === selectedDebitId) ?? null
  const canMerge = selectedDebit !== null && selectedDebit.amount >= credit.amount

  async function confirmMerge() {
    if (!selectedDebit) return
    setMerging(true)
    const response = await fetch("/api/transactions/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creditId: credit.id, debitId: selectedDebit.id }),
    })
    setMerging(false)
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      toast.error(body.error ?? "Could not merge credit")
      return
    }
    toast.success(`Merged ${formatMoney(credit.amount)} into ${selectedDebit.payee}`)
    onClose()
    onMerged?.()
    window.dispatchEvent(new Event("spend:data-changed"))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !merging && onClose()}>
      <DialogContent className="border-0 bg-card sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="size-4" />
            Merge credit into debit
          </DialogTitle>
          <DialogDescription>
            Reduce a debit transaction by <span className="font-mono font-medium text-emerald-400">+{formatMoney(credit.amount)}</span> received from {credit.payee}. The credit will be archived while keeping duplicate protection intact.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Search recent debits by payee..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl bg-muted/20 p-2">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading debits...</div>
            ) : !debits.length ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No matching debits found.</div>
            ) : (
              debits.map((debit) => {
                const tooSmall = debit.amount < credit.amount
                const selected = debit.id === selectedDebitId
                return (
                  <button
                    key={debit.id}
                    type="button"
                    disabled={tooSmall}
                    onClick={() => setSelectedDebitId(debit.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      selected ? "bg-primary/15 ring-1 ring-primary/50" : "hover:bg-muted/40",
                      tooSmall && "cursor-not-allowed opacity-45"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{debit.payee}</span>
                        {debit.tag ? <Badge variant="secondary">{debit.tag}</Badge> : null}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {formatDateTime(debit.timestamp)}
                        {debit.note ? ` · ${debit.note}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono font-medium">{formatMoney(debit.amount)}</div>
                      {tooSmall ? (
                        <div className="text-[11px] text-muted-foreground">Smaller than credit</div>
                      ) : null}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {selectedDebit ? (
            <div className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-3 text-sm">
              <span className="truncate text-muted-foreground">{selectedDebit.payee}</span>
              <div className="flex shrink-0 items-center gap-2 font-mono">
                <span>{formatMoney(selectedDebit.amount)}</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
                <span className="font-semibold text-foreground">
                  {formatMoney(selectedDebit.amount - credit.amount)}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" disabled={merging} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!canMerge || merging} onClick={confirmMerge}>
            {merging ? "Merging..." : "Merge credit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
