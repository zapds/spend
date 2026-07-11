"use client"

import * as React from "react"

import { lockDashboard } from "@/components/password-gate"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

export function SettingsClient() {
  const [status, setStatus] = React.useState("checking")

  React.useEffect(() => {
    fetch("/api/status")
      .then((response) => response.json())
      .then((data) => setStatus(data.status ?? data.error ?? "query_error"))
      .catch(() => setStatus("query_error"))
  }, [])

  return (
    <div className="grid max-w-4xl gap-4">
      <Card className="border-0 bg-card/70">
        <CardHeader><CardTitle>Preferences</CardTitle><CardDescription>Stored locally for this personal dashboard.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4"><div><Label>Compact density</Label><p className="text-sm text-muted-foreground">Tighten rows and cards. UI hook is ready for future persistence.</p></div><Switch /></div>
          <Separator />
          <div className="grid gap-2"><Label>Default date range</Label><Select defaultValue="last_30_days"><SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="last_30_days">Last 30 days</SelectItem><SelectItem value="this_month">This month</SelectItem><SelectItem value="this_week">This week</SelectItem></SelectContent></Select></div>
          <div className="grid gap-1"><Label>Currency</Label><p className="text-sm text-muted-foreground">Amounts are always shown in Indian rupees (₹).</p></div>
        </CardContent>
      </Card>
      <Card className="border-0 bg-card/70">
        <CardHeader><CardTitle>Database status</CardTitle><CardDescription>Secrets are never displayed.</CardDescription></CardHeader>
        <CardContent><div className="rounded-xl bg-muted/30 p-4 font-mono text-sm">{status}</div></CardContent>
      </Card>
      <Card className="border-0 bg-card/70">
        <CardHeader><CardTitle>Lock dashboard</CardTitle><CardDescription>Clears the local unlock flag and returns to the password gate.</CardDescription></CardHeader>
        <CardContent><Button variant="destructive" onClick={lockDashboard}>Lock dashboard</Button></CardContent>
      </Card>
    </div>
  )
}
