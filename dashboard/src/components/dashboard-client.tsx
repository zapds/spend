"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { MetricCard } from "@/components/metric-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney } from "@/lib/format"
import type { MetricCardData } from "@/lib/types"

type DashboardData = {
  kpis: { today: MetricCardData; week: MetricCardData; month: MetricCardData }
  tagBars: Array<{ tag: string; amount: number; count: number }>
  payeeBars: Array<{ payee: string; amount: number; count: number }>
  tagTrend: Array<Record<string, string | number>>
  trendKeys: string[]
}

const barConfig = { amount: { label: "Amount", color: "var(--chart-1)" } } satisfies ChartConfig

export function DashboardClient() {
  const searchParams = useSearchParams()
  const [data, setData] = React.useState<DashboardData | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/dashboard?${searchParams.toString()}`)
      const body = await response.json().catch(() => ({}))
      if (cancelled) return
      if (!response.ok) setError(body.error ?? "Dashboard query failed")
      else setData(body)
      setLoading(false)
    }
    load()
    const handler = () => load()
    window.addEventListener("spend:data-changed", handler)
    return () => {
      cancelled = true
      window.removeEventListener("spend:data-changed", handler)
    }
  }, [searchParams])

  if (loading && !data) {
    return <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
  }

  if (error) {
    return <Card className="border-0 bg-card"><CardHeader><CardTitle>Dashboard unavailable</CardTitle><CardDescription>{error}</CardDescription></CardHeader></Card>
  }

  const trendConfig = {
    trend1: { label: "Trend", color: "var(--chart-1)" },
    trend2: { label: "Trend", color: "var(--chart-2)" },
    trend3: { label: "Trend", color: "var(--chart-3)" },
    trend4: { label: "Trend", color: "var(--chart-4)" },
    trend5: { label: "Trend", color: "var(--chart-5)" },
  } satisfies ChartConfig

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Today" metric={data?.kpis.today} />
        <MetricCard title="This week" metric={data?.kpis.week} />
        <MetricCard title="This month" metric={data?.kpis.month} />
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Spend by tag">
          {data?.tagBars.length ? (
            <ChartContainer className="h-[240px] w-full" config={barConfig}>
              <BarChart accessibilityLayer data={data.tagBars} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis dataKey="amount" hide type="number" />
                <YAxis dataKey="tag" type="category" width={90} tickLine={false} axisLine={false} tick={{ fill: "var(--foreground)" }} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatMoney(Number(value))} />} />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={8} />
              </BarChart>
            </ChartContainer>
          ) : <EmptyState text="No spends in this range." />}
        </ChartCard>
        <ChartCard title="Spend by payee">
          {data?.payeeBars.length ? (
            <ChartContainer className="h-[240px] w-full" config={barConfig}>
              <BarChart accessibilityLayer data={data.payeeBars} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis dataKey="amount" hide type="number" />
                <YAxis dataKey="payee" type="category" width={100} tickLine={false} axisLine={false} tick={{ fill: "var(--foreground)" }} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatMoney(Number(value))} />} />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={8} />
              </BarChart>
            </ChartContainer>
          ) : <EmptyState text="No payee data in this range." />}
        </ChartCard>
      </section>
      <ChartCard title="Tag trend">
        {data?.tagTrend.length && data.trendKeys.length ? (
          <ChartContainer className="h-[320px] w-full" config={trendConfig}>
            <LineChart accessibilityLayer data={data.tagTrend} margin={{ left: 12, right: 18 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tickLine={false} axisLine={false} width={70} tickFormatter={(value) => formatMoney(Number(value))} />
              <ChartTooltip content={<ChartTooltipContent hideZeroValues />} />
              {data.trendKeys.map((key, index) => (
                <Line key={key} dataKey={key} type="monotone" stroke={`var(--chart-${(index % 5) + 1})`} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ChartContainer>
        ) : <EmptyState text="No tagged spends yet." />}
      </ChartCard>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-0 bg-card/70 ring-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex h-[260px] items-center justify-center rounded-xl bg-muted/30 text-sm text-muted-foreground">{text}</div>
}
