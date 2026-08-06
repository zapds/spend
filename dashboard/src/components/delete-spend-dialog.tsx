"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatMoney } from "@/lib/format"
import type { TransactionRow } from "@/lib/types"

export function DeleteSpendDialog({ spend, onClose, onDeleted }: { spend: TransactionRow; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = React.useState(false)

  async function remove() {
    setDeleting(true)
    const response = await fetch(`/api/transactions/${spend.id}`, { method: "DELETE" })
    setDeleting(false)

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      toast.error(body.error ?? "Could not delete spend")
      return
    }

    toast.success("Spend deleted")
    onDeleted()
    window.dispatchEvent(new Event("spend:data-changed"))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !deleting && onClose()}>
      <DialogContent className="border-0 bg-card">
        <DialogHeader>
          <DialogTitle>Delete spend?</DialogTitle>
          <DialogDescription>This permanently deletes {formatMoney(spend.amount)} spent at {spend.payee}.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p className="text-sm">This action cannot be undone.</p>
        </div>
        <DialogFooter>
          <Button variant="secondary" disabled={deleting} onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={deleting} onClick={remove}>{deleting ? "Deleting..." : "Delete spend"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
