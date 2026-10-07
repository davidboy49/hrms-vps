"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useState } from "react"
import { useTheme } from "next-themes"
import { BookOpen, CalendarOff, ChevronDown, Clock, Timer, Database, Megaphone, LayoutDashboard, LogOut, Menu, Moon, Pin, PinOff, Settings, Sun, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { logout } from "@/app/login/actions"
import { initials } from "@/lib/format"
import { useT } from "@/i18n/provider"
import { LanguageSwitcher } from "@/components/language-switcher"
import { NotificationsBell } from "@/components/notifications-bell"

type U = { name: string; email: string; role: string }

type Child = { href: string; label: string; min: number; tab?: string }
type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; min: number; children?: Child[] }
type NavEntry = Item | { group: string }

// Sections that used to be tabs inside a page are now sub-items of their group.
const NAV: NavEntry[] = [
  { href: "/", label: "nav.dashboard", icon: LayoutDashboard, min: 0 },
  { href: "/employees", label: "nav.employees", icon: Users, min: 1 },
  {
    href: "/attendance",
    label: "nav.attendance",
    icon: Clock,
    min: 1,
    children: [
      { href: "/attendance", label: "att.tab.punches", min: 1, tab: "punches" },
      { href: "/attendance?tab=daily", label: "att.tab.daily", min: 1, tab: "daily" },
      { href: "/attendance/roster", label: "att.tab.roster", min: 1 },
      { href: "/attendance/templates", label: "att.tab.templates", min: 2 },
      { href: "/attendance?tab=devices", label: "att.tab.devices", min: 1, tab: "devices" },
      { href: "/attendance/qr", label: "att.qr", min: 2 },
    ],
  },
  { href: "/leave", label: "nav.leave", icon: CalendarOff, min: 0 },
  { href: "/overtime", label: "nav.overtime", icon: Timer, min: 0 },
  { href: "/announcements", label: "nav.announcements", icon: Megaphone, min: 2 },
  { href: "/guide", label: "nav.guide", icon: BookOpen, min: 0 },
  { group: "nav.admin" },
  {
    href: "/masterdata",
    label: "nav.masterdata",
    icon: Database,
    min: 2,
    children: ["departments", "designations", "contract-types", "statuses", "locations", "shifts", "holidays"].map((k) => ({ href: `/masterdata/${k}`, label: `md.${k}`, min: 2 })),
  },
  {
    href: "/settings",
    label: "nav.settings",
    icon: Settings,
    min: 2,
    children: [
      { href: "/settings?tab=company", label: "set.tab.company", min: 2, tab: "company" },
      { href: "/settings?tab=users", label: "set.tab.users", min: 3, tab: "users" },
      { href: "/settings?tab=attendance", label: "set.tab.attendance", min: 2, tab: "attendance" },
      { href: "/settings?tab=numbering", label: "set.tab.numbering", min: 2, tab: "numbering" },
      { href: "/settings?tab=templates", label: "set.tab.templates", min: 2, tab: "templates" },
      { href: "/settings?tab=notifications", label: "set.tab.notifications", min: 3, tab: "notifications" },
      { href: "/settings?tab=audit", label: "set.tab.audit", min: 3, tab: "audit" },
      { href: "/settings?tab=account", label: "set.tab.account", min: 2, tab: "account" },
    ],
  },
]

const RANK: Record<string, number> = { EMPLOYEE: 0, MANAGER: 1, HR: 2, ADMIN: 3 }
const PIN_COOKIE = "pd_sidebar"

function Brand({ company, logoUrl, compact }: { company: string; logoUrl: string; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {logoUrl ? (
        // the logo is shown on white so any logo stays readable in light and dark themes
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="size-9 shrink-0 rounded-xl bg-white object-contain p-0.5 ring-1 ring-border" />
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Users className="size-4" />
        </span>
      )}
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold" title={company}>
            {company}
          </span>
          <span className="block text-[11px] text-muted-foreground">PeopleDesk</span>
        </span>
      )}
    </div>
  )
}

function Nav({ role, onNavigate, compact }: { role: string; onNavigate?: () => void; compact?: boolean }) {
  const t = useT()
  const path = usePathname()
  const params = useSearchParams()
  const rank = RANK[role] ?? 0
  const tabParam = params.get("tab")

  // a child is current when its page matches and, for tabbed pages, its tab does
  const childActive = (parent: Item, c: Child) => {
    if (c.tab) {
      const base = c.href.split("?")[0]
      if (path !== base) return false
      const first = parent.children![0].tab
      return (tabParam ?? first) === c.tab
    }
    return path === c.href
  }
  const itemActive = (n: Item) => (n.children ? path.startsWith(n.href) : n.href === "/" ? path === "/" : path.startsWith(n.href))

  // groups the person has opened or closed by hand; otherwise the group with the current page is open
  const [manual, setManual] = useState<Record<string, boolean>>({})

  const items = NAV.filter((n) => !("min" in n) || rank >= n.min)
  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      {items.map((n, i) => {
        if (!("min" in n)) {
          return compact ? (
            <span key={i} className="mx-2 my-2 border-t" />
          ) : (
            <p key={i} className="px-2 pt-4 pb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t(n.group)}
            </p>
          )
        }
        const kids = n.children?.filter((c) => rank >= c.min)
        const active = itemActive(n)
        const base = "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        const activeCls = "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent"

        // plain link, or a group shown as a single icon in the narrow rail
        if (!kids || kids.length === 0 || compact) {
          return (
            <Link key={n.href} href={kids?.[0]?.href ?? n.href} onClick={onNavigate} title={compact ? t(n.label) : undefined} className={cn(base, active && activeCls)}>
              <n.icon className="size-4 shrink-0" />
              {!compact && t(n.label)}
            </Link>
          )
        }

        const open = manual[n.href] ?? active
        return (
          <div key={n.href}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setManual((m) => ({ ...m, [n.href]: !open }))}
              className={cn(base, "w-full", active && !open && activeCls)}
            >
              <n.icon className="size-4 shrink-0" />
              <span className="flex-1 text-left">{t(n.label)}</span>
              <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
              <ul className="ml-[1.1rem] mt-0.5 space-y-0.5 border-l pl-2">
                {kids.map((c) => (
                  <li key={c.href}>
                    <Link
                      href={c.href}
                      onClick={onNavigate}
                      aria-current={childActive(n, c) ? "page" : undefined}
                      className={cn(
                        "block truncate rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground",
                        childActive(n, c) && "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent",
                      )}
                    >
                      {t(c.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </nav>
  )
}

export function AppShell({ user, company, logoUrl, initialPinned, notice, children }: { user: U; company: string; logoUrl: string; initialPinned: boolean; notice?: React.ReactNode; children: React.ReactNode }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(initialPinned)
  const [hover, setHover] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const expanded = pinned || hover
  const canSeeAlerts = (RANK[user.role] ?? 0) >= 1

  function togglePin() {
    const next = !pinned
    setPinned(next)
    // remembered in a cookie so the server renders the right width on the next page load
    document.cookie = `${PIN_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`
  }

  return (
    <div className="flex min-h-svh">
      {/* Desktop sidebar. Pinned: always open. Unpinned: a narrow icon rail that opens over the page on hover. */}
      <aside className={cn("relative hidden shrink-0 transition-[width] duration-200 md:block", pinned ? "w-60" : "w-16")}>
        <div
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onFocusCapture={() => setHover(true)}
          onBlurCapture={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setHover(false)}
          className={cn(
            "sticky top-0 z-30 flex h-svh flex-col overflow-hidden border-r bg-sidebar p-3 transition-[width,box-shadow] duration-200",
            expanded ? "w-60" : "w-16",
            !pinned && hover && "shadow-xl",
          )}
        >
          <div className="mb-4 flex items-center justify-between gap-1 px-0.5">
            {user.role === "ADMIN" && expanded ? (
              <Link href="/settings?tab=company" className="min-w-0 rounded-lg hover:opacity-80" title={t("shell.editCompany")}>
                <Brand company={company} logoUrl={logoUrl} />
              </Link>
            ) : (
              <Brand company={company} logoUrl={logoUrl} compact={!expanded} />
            )}
            {expanded && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={togglePin}
                aria-pressed={pinned}
                aria-label={pinned ? t("shell.unpin") : t("shell.pin")}
                title={pinned ? t("shell.unpin") : t("shell.pin")}
                className={cn(pinned && "text-primary")}
              >
                {pinned ? <Pin /> : <PinOff />}
              </Button>
            )}
          </div>
          <Nav role={user.role} compact={!expanded} />
        </div>
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-3">
          <SheetTitle className="sr-only">{t("nav.navigation")}</SheetTitle>
          <div className="mb-4 px-0.5">
            <Brand company={company} logoUrl={logoUrl} />
          </div>
          <Nav role={user.role} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-2 border-b px-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label={t("nav.openMenu")}>
            <Menu />
          </Button>
          <div className="flex-1" />
          <LanguageSwitcher />
          {canSeeAlerts && <NotificationsBell />}
          <Button variant="ghost" size="icon" aria-label={t("nav.toggleTheme")} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            <Sun className="hidden dark:block" />
            <Moon className="dark:hidden" />
          </Button>
          <div className="flex items-center gap-2 text-sm">
            <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">{initials(user.name)}</span>
            <div className="hidden leading-tight sm:block">
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{t(`role.${user.role}`)}</p>
            </div>
          </div>
          <form action={logout}>
            <Button variant="ghost" size="icon" type="submit" aria-label={t("nav.signOut")}>
              <LogOut />
            </Button>
          </form>
        </header>
        {notice}
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
