"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { PayeeRuleDialog, type PayeeRule } from "@/components/payee-rule-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime, formatMoney } from "@/lib/format"

type Suggestion = { payee: string; spend_count: number; totalSpend: number; last_seen: string | null }

export function PayeesClient() {
  const [rows, setRows] = React.useState<PayeeRule[]>([])
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([])
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PayeeRule | null>(null)
  const [defaultName, setDefaultName] = React.useState("")

  const load = React.useCallback(async () => {
    const response = await fetch("/api/payees")
    const body = await response.json().catch(() => ({}))
    if (!response.ok) toast.error(body.error ?? "Could not load payees")
    else {
      setRows(body.rows ?? [])
      setSuggestions(body.suggestions ?? [])
    }
  }, [])

  React.useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  function openAdd(name = "") {
    setEditing(null)
    setDefaultName(name)
    setDialogOpen(true)
  }

  async function remove(rule: PayeeRule) {
    const response = await fetch(`/api/payees/${rule.id}`, { method: "DELETE" })
    if (!response.ok) toast.error("Could not remove payee rule")
    else {
      toast.success("Payee rule removed")
      load()
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <Card className="border-0 bg-card/70">
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div><CardTitle>Known payees</CardTitle><CardDescription>Rules use exact payee text and always require one default tag.</CardDescription></div>
          <Button onClick={() => openAdd()}><Plus className="size-4" /> Add payee</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl bg-muted/20">
            <Table>
              <TableHeader><TableRow className="border-white/5"><TableHead>Payee</TableHead><TableHead>Default tag</TableHead><TableHead>Spend count</TableHead><TableHead>Total</TableHead><TableHead>Last seen</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className="border-white/5">
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell><Badge variant="secondary">{row.tag}</Badge></TableCell>
                    <TableCell>{row.spend_count ?? 0}</TableCell>
                    <TableCell className="font-mono">{formatMoney(row.totalSpend ?? 0)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(row.last_seen)}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => { setEditing(row); setDialogOpen(true) }}>Edit</Button><Button size="icon" variant="ghost" onClick={() => remove(row)}><Trash2 className="size-4" /></Button></TableCell>
                  </TableRow>
                ))}
                {!rows.length ? <TableRow><TableCell className="h-28 text-center text-muted-foreground" colSpan={6}>No payee rules yet.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Card className="border-0 bg-card/70">
        <CardHeader><CardTitle>Suggested rules</CardTitle><CardDescription>Frequent payees without a default.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {suggestions.map((item) => (
            <div key={item.payee} className="rounded-xl bg-muted/30 p-3">
              <div className="flex items-start justify-between gap-3"><div><div className="font-medium">{item.payee}</div><div className="text-xs text-muted-foreground">{item.spend_count} spends · {formatMoney(item.totalSpend)}</div></div><Button size="sm" variant="secondary" onClick={() => openAdd(item.payee)}>Create</Button></div>
            </div>
          ))}
          {!suggestions.length ? <p className="text-sm text-muted-foreground">No suggestions right now.</p> : null}
        </CardContent>
      </Card>
      <PayeeRuleDialog open={dialogOpen} onOpenChange={setDialogOpen} rule={editing} defaultName={defaultName} onSaved={load} />
    </div>
  )
}
