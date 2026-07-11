"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BarChart3, CreditCard, Home, Plus, Settings, Sparkles, Tags } from "lucide-react"

import { AddSpendDialog } from "@/components/add-spend-dialog"
import { DateRangeControls } from "@/components/date-range-controls"
import { PasswordGate } from "@/components/password-gate"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/transactions", label: "Transactions", icon: CreditCard },
  { href: "/review", label: "Review", icon: Sparkles },
  { href: "/payees", label: "Payees", icon: Tags },
  { href: "/settings", label: "Settings", icon: Settings },
]

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/transactions": "Transactions",
  "/review": "Review inbox",
  "/payees": "Payee rules",
  "/settings": "Settings",
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [addOpen, setAddOpen] = React.useState(false)
  const title = titles[pathname] ?? "Spend"

  function refreshAfterCreate() {
    router.refresh()
    window.dispatchEvent(new Event("spend:data-changed"))
  }

  return (
    <PasswordGate>
      <SidebarProvider>
        <Sidebar className="border-r-0 bg-sidebar/70" collapsible="offcanvas">
          <SidebarHeader className="px-3 py-4">
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
                <BarChart3 className="size-4" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">spend</div>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.map((item) => {
                    const active = pathname === item.href || (pathname === "/" && item.href === "/dashboard")
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={active}>
                          <Link href={item.href}>
                            <item.icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="min-h-svh bg-background">
          <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 bg-background/85 px-4 backdrop-blur md:px-6">
            <SidebarTrigger />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold tracking-tight md:text-base">{title}</h1>
            </div>
            <div className={cn("hidden md:block", pathname === "/settings" && "invisible")}>
              <DateRangeControls searchParams={searchParams} />
            </div>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              Add spend
            </Button>
          </header>
          <div className="border-t border-white/5 md:hidden">
            <div className="px-4 py-3">
              <DateRangeControls searchParams={searchParams} />
            </div>
          </div>
          <main className="p-4 md:p-6">{children}</main>
          <AddSpendDialog open={addOpen} onOpenChange={setAddOpen} onCreated={refreshAfterCreate} />
        </SidebarInset>
      </SidebarProvider>
    </PasswordGate>
  )
}
