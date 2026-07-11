"use client"

import * as React from "react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TagOption } from "@/lib/types"

export function useTags() {
  const [tags, setTags] = React.useState<TagOption[]>([])

  React.useEffect(() => {
    let cancelled = false
    fetch("/api/tags")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setTags(data.rows ?? [])
      })
      .catch(() => {
        if (!cancelled) setTags([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return tags
}

export function TagSelect({
  value,
  onValueChange,
  placeholder = "Select tag",
}: {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
}) {
  const tags = useTags()
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {tags.map((tag) => (
          <SelectItem key={tag.id} value={tag.name}>
            {tag.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
