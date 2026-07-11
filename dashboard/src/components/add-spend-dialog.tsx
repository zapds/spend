"use client"

import * as React from "react"
import { toast } from "sonner"

import { TagSelect } from "@/components/tag-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function AddSpendDialog({
  open,
  onOpenChange,
  onCreated,
  defaultPayee = "",
  defaultTag,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
  defaultPayee?: string
  defaultTag?: string
}) {
  const [amount, setAmount] = React.useState("")
  const [payee, setPayee] = React.useState(defaultPayee)
  const [tag, setTag] = React.useState(defaultTag ?? "")
  const [note, setNote] = React.useState("")
  const [timestamp, setTimestamp] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => {
        setPayee(defaultPayee)
        setTag(defaultTag ?? "")
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [defaultPayee, defaultTag, open])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    const isoTimestamp = timestamp ? new Date(timestamp).toISOString() : undefined
    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, payee, tag: tag || undefined, note, timestamp: isoTimestamp }),
    })
    setSubmitting(false)
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      toast.error(data.error ?? "Could not add spend")
      return
    }
    toast.success("Spend added")
    setAmount("")
    setPayee("")
    setTag("")
    setNote("")
    setTimestamp("")
    onOpenChange(false)
    onCreated?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-0 bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add spend</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" inputMode="decimal" placeholder="250.00" value={amount} onChange={(event) => setAmount(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payee">Payee</Label>
              <Input id="payee" placeholder="Uber" value={payee} onChange={(event) => setPayee(event.target.value)} required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tag</Label>
              <TagSelect value={tag || undefined} onValueChange={setTag} placeholder="Use payee default" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timestamp">Timestamp</Label>
              <Input id="timestamp" type="datetime-local" value={timestamp} onChange={(event) => setTimestamp(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea id="note" placeholder="Optional context" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={submitting || !amount || !payee} type="submit">{submitting ? "Adding..." : "Add spend"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
