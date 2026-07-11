"use client"

import * as React from "react"
import { toast } from "sonner"

import { PayeeRuleDialog } from "@/components/payee-rule-dialog"
import { TagSelect } from "@/components/tag-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatExactDateTime, formatMoney, formatRelativeTime } from "@/lib/format"
import type { TransactionRow } from "@/lib/types"

type ReviewSpend = TransactionRow & { default_tag: string | null }
type UnknownPayee = { payee: string; spend_count: number; totalSpend: number; last_seen: string | null }
type ReviewData = { last: ReviewSpend[]; untagged: ReviewSpend[]; missingNotes: ReviewSpend[]; unknownPayees: UnknownPayee[] }

export function ReviewClient() {
  const [data, setData] = React.useState<ReviewData>({ last: [], untagged: [], missingNotes: [], unknownPayees: [] })
  const [payeeDialog, setPayeeDialog] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    const response = await fetch("/api/review")
    const body = await response.json().catch(() => ({}))
    if (!response.ok) toast.error(body.error ?? "Could not load review queue")
    else setData(body)
  }, [])

  React.useEffect(() => {
    const timer = window.setTimeout(load, 0)
    window.addEventListener("spend:data-changed", load)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("spend:data-changed", load)
    }
  }, [load])

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Queue title="Last 10 spends" spends={data.last} onChanged={load} onCreatePayee={setPayeeDialog} />
        <Queue title="Untagged spends" spends={data.untagged} onChanged={load} onCreatePayee={setPayeeDialog} />
        <Queue title="Missing notes" spends={data.missingNotes} onChanged={load} onCreatePayee={setPayeeDialog} />
      </div>
      <Card className="h-fit border-0 bg-card/70">
        <CardHeader><CardTitle>Unknown payees</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.unknownPayees.map((payee) => (
            <div key={payee.payee} className="rounded-xl bg-muted/30 p-3">
              <div className="font-medium">{payee.payee}</div>
              <div className="text-xs text-muted-foreground">{payee.spend_count} spends · {formatMoney(payee.totalSpend)}</div>
              <Button className="mt-3 w-full" size="sm" variant="secondary" onClick={() => setPayeeDialog(payee.payee)}>Save default</Button>
            </div>
          ))}
          {!data.unknownPayees.length ? <p className="text-sm text-muted-foreground">No unknown payees to review.</p> : null}
        </CardContent>
      </Card>
      <PayeeRuleDialog open={payeeDialog !== null} onOpenChange={(open) => !open && setPayeeDialog(null)} defaultName={payeeDialog ?? ""} onSaved={() => { setPayeeDialog(null); load() }} />
    </div>
  )
}

function Queue({ title, spends, onChanged, onCreatePayee }: { title: string; spends: ReviewSpend[]; onChanged: () => void; onCreatePayee: (payee: string) => void }) {
  return (
    <Card className="border-0 bg-card/70">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {spends.map((spend) => <SpendReviewRow key={`${title}-${spend.id}`} spend={spend} onChanged={onChanged} onCreatePayee={onCreatePayee} />)}
        {!spends.length ? <div className="rounded-xl bg-muted/20 p-6 text-center text-sm text-muted-foreground">Queue is clear.</div> : null}
      </CardContent>
    </Card>
  )
}

function SpendReviewRow({ spend, onChanged, onCreatePayee }: { spend: ReviewSpend; onChanged: () => void; onCreatePayee: (payee: string) => void }) {
  const [tag, setTag] = React.useState(spend.tag ?? "")
  const [note, setNote] = React.useState(spend.note ?? "")
  const [saving, setSaving] = React.useState(false)

  async function save(clearTag = false) {
    setSaving(true)
    const response = await fetch(`/api/transactions/${spend.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, tag: clearTag ? undefined : tag || undefined, clearTag }),
    })
    setSaving(false)
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      toast.error(body.error ?? "Could not update spend")
      return
    }
    toast.success("Review item saved")
    onChanged()
    window.dispatchEvent(new Event("spend:data-changed"))
  }

  return (
    <div className="rounded-xl bg-muted/25 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="font-mono text-3xl font-semibold tracking-tight text-foreground">{formatMoney(spend.amount)}</div>
          <div className="min-w-0">
            <div className="truncate font-medium">{spend.payee}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="underline-offset-2 hover:underline" type="button">{formatRelativeTime(spend.timestamp)}</button>
                </TooltipTrigger>
                <TooltipContent>{formatExactDateTime(spend.timestamp)}</TooltipContent>
              </Tooltip>
              {spend.tag ? <Badge variant="secondary">{spend.tag}</Badge> : <Badge variant="outline">Untagged</Badge>}
              {spend.default_tag ? <span>default: {spend.default_tag}</span> : null}
            </div>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => onCreatePayee(spend.payee)}>Payee default</Button>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[220px_1fr_auto]">
        <TagSelect value={tag || undefined} onValueChange={setTag} />
        <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add note" />
        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={saving} onClick={() => save(true)}>Clear</Button><Button size="sm" disabled={saving} onClick={() => save(false)}>Save</Button></div>
      </div>
    </div>
  )
}
