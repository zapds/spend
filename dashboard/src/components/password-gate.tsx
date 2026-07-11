"use client"

import * as React from "react"
import { LockKeyhole } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const STORAGE_KEY = "spend-dashboard-unlocked"

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false)
  const [unlocked, setUnlocked] = React.useState(false)
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true")
      setReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    setSubmitting(false)
    if (!response.ok) {
      setError("Password did not unlock this dashboard.")
      return
    }
    window.localStorage.setItem(STORAGE_KEY, "true")
    setUnlocked(true)
  }

  if (!ready) return null
  if (unlocked) return children

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm border-0 bg-card/80 shadow-2xl shadow-black/40 ring-0">
        <CardHeader className="gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground">
            <LockKeyhole className="size-5" />
          </div>
          <div>
            <CardTitle>Unlock spend desk</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">Dashboard password</Label>
              <Input
                id="password"
                type="password"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
              />
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <Button className="w-full" disabled={submitting || !password} type="submit">
              {submitting ? "Unlocking..." : "Unlock dashboard"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

export function lockDashboard() {
  window.localStorage.removeItem(STORAGE_KEY)
  window.location.href = "/"
}
