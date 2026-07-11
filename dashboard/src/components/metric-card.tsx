import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMoney, formatPercent } from "@/lib/format"
import type { MetricCardData } from "@/lib/types"

export function MetricCard({ title, metric }: { title: string; metric?: MetricCardData }) {
  const up = (metric?.deltaPercent ?? 0) > 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <Card className="border-0 bg-card/80 ring-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="font-mono text-3xl font-semibold tracking-tight">{formatMoney(metric?.amount ?? 0)}</div>
        <div className="mt-3 flex items-center justify-end text-xs text-muted-foreground">
          <span className={up ? "flex items-center gap-1 text-red-400" : "flex items-center gap-1 text-green-400"}>
            <Icon className="size-3.5" />
            {formatPercent(metric?.deltaPercent)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
