"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import { TagSelect, useTags } from "@/components/tag-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTime, formatMoney } from "@/lib/format"
import type { TransactionRow } from "@/lib/types"

type TransactionsData = { rows: TransactionRow[]; total: number }

export function TransactionsClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tags = useTags()
  const [data, setData] = React.useState<TransactionsData>({ rows: [], total: 0 })
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState<TransactionRow | null>(null)
  const limit = Number(searchParams.get("limit") ?? 25)
  const offset = Number(searchParams.get("offset") ?? 0)

  const load = React.useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams(searchParams.toString())
    if (!params.has("limit")) params.set("limit", "25")
    const response = await fetch(`/api/transactions?${params.toString()}`)
    const body = await response.json().catch(() => ({}))
    if (!response.ok) toast.error(body.error ?? "Could not load transactions")
    else setData(body)
    setLoading(false)
  }, [searchParams])

  React.useEffect(() => {
    const timer = window.setTimeout(load, 0)
    window.addEventListener("spend:data-changed", load)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("spend:data-changed", load)
    }
  }, [load])

  function updateParam(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(next).forEach(([key, value]) => {
      if (!value || value === "all") params.delete(key)
      else params.set(key, value)
    })
    params.set("offset", "0")
    router.push(`?${params.toString()}`)
  }

  function move(nextOffset: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("offset", String(Math.max(nextOffset, 0)))
    params.set("limit", String(limit))
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 bg-card/70">
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>Filter, sort, and clean up spend records. Date range comes from the toolbar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-6">
            <Input placeholder="Payee contains" defaultValue={searchParams.get("payee") ?? ""} onBlur={(event) => updateParam({ payee: event.target.value })} />
            <Select value={searchParams.get("tag") ?? "all"} onValueChange={(value) => updateParam({ tag: value })}>
              <SelectTrigger><SelectValue placeholder="Tag" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {tags.map((tag) => <SelectItem key={tag.id} value={tag.name}>{tag.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Min" defaultValue={searchParams.get("amountMin") ?? ""} onBlur={(event) => updateParam({ amountMin: event.target.value })} />
            <Input placeholder="Max" defaultValue={searchParams.get("amountMax") ?? ""} onBlur={(event) => updateParam({ amountMax: event.target.value })} />
            <Select value={searchParams.get("tagged") ?? "all"} onValueChange={(value) => updateParam({ tagged: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All records</SelectItem>
                <SelectItem value="tagged">Tagged only</SelectItem>
                <SelectItem value="untagged">Untagged only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={searchParams.get("sort") ?? "date"} onValueChange={(value) => updateParam({ sort: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Sort date</SelectItem>
                <SelectItem value="amount">Sort amount</SelectItem>
                <SelectItem value="payee">Sort payee</SelectItem>
                <SelectItem value="tag">Sort tag</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-hidden rounded-xl bg-muted/20">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5">
                  <TableHead>Date/time</TableHead><TableHead>Amount</TableHead><TableHead>Payee</TableHead><TableHead>Tag</TableHead><TableHead>Note</TableHead><TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.id} className="border-white/5">
                    <TableCell className="text-muted-foreground">{formatDateTime(row.timestamp)}</TableCell>
                    <TableCell className="font-mono">{formatMoney(row.amount)}</TableCell>
                    <TableCell>{row.payee}</TableCell>
                    <TableCell>{row.tag ? <Badge variant="secondary">{row.tag}</Badge> : <Badge variant="outline">Untagged</Badge>}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{row.note ?? "-"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditing(row)}>Edit note/tag</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {!data.rows.length ? <TableRow><TableCell className="h-28 text-center text-muted-foreground" colSpan={6}>{loading ? "Loading..." : "No transactions in this range."}</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{data.total} total</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={offset <= 0} onClick={() => move(offset - limit)}>Previous</Button>
              <Button size="sm" variant="secondary" disabled={offset + limit >= data.total} onClick={() => move(offset + limit)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {editing ? <EditTransactionDialog row={editing} onClose={() => setEditing(null)} onSaved={load} /> : null}
    </div>
  )
}

function EditTransactionDialog({ row, onClose, onSaved }: { row: TransactionRow; onClose: () => void; onSaved: () => void }) {
  const [note, setNote] = React.useState(row.note ?? "")
  const [tag, setTag] = React.useState(row.tag ?? "")
  const [saving, setSaving] = React.useState(false)

  async function save(clearTag = false) {
    setSaving(true)
    const response = await fetch(`/api/transactions/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, tag: clearTag ? undefined : tag || undefined, clearTag }),
    })
    setSaving(false)
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      toast.error(body.error ?? "Could not update transaction")
      return
    }
    toast.success("Transaction updated")
    onClose()
    onSaved()
    window.dispatchEvent(new Event("spend:data-changed"))
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="border-0 bg-card">
        <DialogHeader><DialogTitle>Edit spend</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2"><Label>Tag</Label><TagSelect value={tag || undefined} onValueChange={setTag} /></div>
          <div className="grid gap-2"><Label>Note</Label><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" disabled={saving} onClick={() => save(true)}>Clear tag</Button>
          <div className="flex gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={() => save(false)}>Save</Button></div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
