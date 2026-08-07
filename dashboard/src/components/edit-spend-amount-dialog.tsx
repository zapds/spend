"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TransactionRow } from "@/lib/types"

export function EditSpendAmountDialog({ spend, onClose }: { spend: TransactionRow; onClose: () => void }) {
  const [amount, setAmount] = React.useState(String(spend.amount))
  const [saving, setSaving] = React.useState(false)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    const response = await fetch(`/api/transactions/${spend.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    })
    setSaving(false)

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      toast.error(body.error ?? "Could not update spend amount")
      return
    }

    toast.success("Spend amount updated")
    onClose()
    window.dispatchEvent(new Event("spend:data-changed"))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="border-0 bg-card">
        <form className="contents" onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Edit amount</DialogTitle>
            <DialogDescription>Update the amount for {spend.payee}. The payee will not be changed.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`spend-amount-${spend.id}`}>Amount</Label>
            <Input
              id={`spend-amount-${spend.id}`}
              autoFocus
              inputMode="decimal"
              pattern="[0-9]+([.][0-9]{1,2})?"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save amount"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
