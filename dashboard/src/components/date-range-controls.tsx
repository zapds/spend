"use client"

import { useRouter, type ReadonlyURLSearchParams } from "next/navigation"

import { RANGE_OPTIONS, type RangeKey, toDateInputValue } from "@/lib/date-ranges"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function DateRangeControls({ searchParams }: { searchParams: ReadonlyURLSearchParams }) {
  const router = useRouter()
  const range = (searchParams.get("range") as RangeKey | null) ?? "last_30_days"
  const today = toDateInputValue(new Date())

  function update(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(next).forEach(([key, value]) => {
      if (value === null || value === "") params.delete(key)
      else params.set(key, value)
    })
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={range} onValueChange={(value) => update({ range: value, dateStart: null, dateEnd: null })}>
        <SelectTrigger className="h-9 w-[150px] bg-muted/50">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGE_OPTIONS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>
      {range === "custom" ? (
        <>
          <Input
            className="h-9 w-[142px] bg-muted/50"
            max={today}
            type="date"
            value={searchParams.get("dateStart") ?? ""}
            onChange={(event) => update({ range: "custom", dateStart: event.target.value })}
          />
          <Input
            className="h-9 w-[142px] bg-muted/50"
            max={today}
            type="date"
            value={searchParams.get("dateEnd") ?? ""}
            onChange={(event) => update({ range: "custom", dateEnd: event.target.value })}
          />
        </>
      ) : null}
    </div>
  )
}
