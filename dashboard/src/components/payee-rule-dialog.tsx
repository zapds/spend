"use client"

import * as React from "react"
import { toast } from "sonner"

import { TagSelect } from "@/components/tag-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type PayeeRule = { id: number; name: string; tag: string; spend_count?: number; totalSpend?: number; last_seen?: string | null }

export function PayeeRuleDialog({
  open,
  onOpenChange,
  rule,
  defaultName = "",
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: PayeeRule | null
  defaultName?: string
  onSaved?: () => void
}) {
  const [name, setName] = React.useState(defaultName)
  const [tag, setTag] = React.useState(rule?.tag ?? "")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => {
        setName(rule?.name ?? defaultName)
        setTag(rule?.tag ?? "")
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [defaultName, open, rule])

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    const response = await fetch(rule ? `/api/payees/${rule.id}` : "/api/payees", {
      method: rule ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, tag }),
    })
    setSaving(false)
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      toast.error(body.error ?? "Could not save payee rule")
      return
    }
    toast.success(rule ? "Payee rule updated" : "Payee rule added")
    onOpenChange(false)
    onSaved?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-0 bg-card">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit payee rule" : "Add payee rule"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <div className="space-y-2"><Label>Payee name</Label><Input value={name} onChange={(event) => setName(event.target.value)} required /></div>
          <div className="space-y-2"><Label>Default tag</Label><TagSelect value={tag || undefined} onValueChange={setTag} /></div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={saving || !name || !tag} type="submit">{saving ? "Saving..." : "Save rule"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
