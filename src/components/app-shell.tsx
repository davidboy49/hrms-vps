"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { BookOpen, CalendarOff, ChevronDown, Clock, Timer, Database, Megaphone, LayoutDashboard, Menu, Moon, Pin, PinOff, Settings, Star, Sun, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { SignOutButton } from "@/components/sign-out-button"
import { saveFavorites } from "@/app/(app)/favorites-action"
import { initials } from "@/lib/format"
import { can, type Permission } from "@/lib/permissions"
import { useT } from "@/i18n/provider"
import { LanguageSwitcher } from "@/components/language-switcher"
import { NotificationsBell } from "@/components/notifications-bell"

type U = { name: string; username: string; email: string | null; role: string; roleName: string; roleIsSystem: boolean; perms: Permission[] }

type Child = { href: string; label: string; perm: Permission; tab?: string }
type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; perm?: Permission; children?: Child[] }
type NavEntry = Item | { group: string }

// Sections that used to be tabs inside a page are now sub-items of their group.
// An item with no `perm` is for everyone; a group with sub-items is hidden when none of them is allowed.
const NAV: NavEntry[] = [
  { href: "/", label: "nav.dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "nav.employees", icon: Users, perm: "employees.view" },
  {
    href: "/attendance",
    label: "nav.attendance",
    icon: Clock,
    children: [
      { href: "/attendance", label: "att.tab.punches", perm: "attendance.view", tab: "punches" },
      { href: "/attendance?tab=daily", label: "att.tab.daily", perm: "attendance.view", tab: "daily" },
      { href: "/attendance/roster", label: "att.tab.roster", perm: "roster.view" },
      { href: "/attendance/templates", label: "att.tab.templates", perm: "roster.edit" },
      { href: "/attendance?tab=devices", label: "att.tab.devices", perm: "attendance.view", tab: "devices" },
      { href: "/attendance/qr", label: "att.qr", perm: "qr.manage" },
    ],
  },
  { href: "/leave", label: "nav.leave", icon: CalendarOff },
  { href: "/overtime", label: "nav.overtime", icon: Timer },
  { href: "/announcements", label: "nav.announcements", icon: Megaphone, perm: "announcements.manage" },
  { href: "/guide", label: "nav.guide", icon: BookOpen },
  { group: "nav.admin" },
  {
    href: "/masterdata",
    label: "nav.masterdata",
    icon: Database,
    children: ["departments", "designations", "contract-types", "statuses", "locations", "shifts", "holidays"].map((k) => ({ href: `/masterdata/${k}`, label: `md.${k}`, perm: "masterdata.view" as Permission })),
  },
  {
    href: "/settings",
    label: "nav.settings",
    icon: Settings,
    children: [
      { href: "/settings?tab=company", label: "set.tab.company", perm: "settings.view", tab: "company" },
      { href: "/settings?tab=users", label: "set.tab.users", perm: "users.manage", tab: "users" },
      { href: "/settings?tab=roles", label: "set.tab.roles", perm: "roles.manage", tab: "roles" },
      { href: "/settings?tab=attendance", label: "set.tab.attendance", perm: "settings.view", tab: "attendance" },
      { href: "/settings?tab=numbering", label: "set.tab.numbering", perm: "settings.view", tab: "numbering" },
      { href: "/settings?tab=templates", label: "set.tab.templates", perm: "settings.view", tab: "templates" },
      { href: "/settings?tab=notifications", label: "set.tab.notifications", perm: "settings.notifications", tab: "notifications" },
      { href: "/settings?tab=audit", label: "set.tab.audit", perm: "audit.view", tab: "audit" },
      { href: "/settings?tab=account", label: "set.tab.account", perm: "settings.view", tab: "account" },
    ],
  },
]

const PIN_COOKIE = "pd_sidebar"
const LEGACY_FAV_KEY = "pd_favorites" // favourites used to live in the browser; moved to the user record

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

function Nav({ perms, favs, onToggleFav, onNavigate, compact }: { perms: readonly string[]; favs: string[]; onToggleFav: (href: string) => void; onNavigate?: () => void; compact?: boolean }) {
  const t = useT()
  const path = usePathname()
  const params = useSearchParams()
  const allowed = (p?: Permission) => !p || can({ perms }, p)
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

  const toggleFav = onToggleFav
  const star = (href: string, cls?: string) => {
    const on = favs.includes(href)
    const label = t(on ? "nav.removeFavorite" : "nav.addFavorite")
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={on}
        title={label}
        onClick={() => toggleFav(href)}
        className={cn(
          "absolute right-1 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-amber-500 focus-visible:opacity-100",
          on ? "text-amber-500" : "opacity-0 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100",
          cls,
        )}
      >
        <Star className={cn("size-3.5", on && "fill-current")} />
      </button>
    )
  }

  // every visible link, so the favourites list can show it with the right label and icon
  const links = new Map<string, { label: string; icon: React.ComponentType<{ className?: string }> }>()
  for (const n of NAV) {
    if (!("href" in n)) continue
    const kids = n.children?.filter((c) => allowed(c.perm))
    if (!n.children && !allowed(n.perm)) continue
    if (kids && kids.length) for (const c of kids) links.set(c.href, { label: c.label, icon: n.icon })
    else links.set(n.href, { label: n.label, icon: n.icon })
  }
  const favLinks = favs.filter((h) => links.has(h))

  // drop what the person may not open, then any heading or group left with nothing under it
  const visible = NAV.filter((n) => !("href" in n) || (n.children ? n.children.some((c) => allowed(c.perm)) : allowed(n.perm)))
  const items = visible.filter((n, i) => "href" in n || "href" in (visible[i + 1] ?? { group: "" }))
  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      {!compact && favLinks.length > 0 && (
        <div className="mb-1">
          <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("nav.favorites")}</p>
          {favLinks.map((h) => {
            const l = links.get(h)!
            return (
              <div key={h} className="group/row relative">
                <Link
                  href={h}
                  onClick={onNavigate}
                  className="flex items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 pr-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <l.icon className="size-4 shrink-0" />
                  <span className="truncate">{t(l.label)}</span>
                </Link>
                {star(h)}
              </div>
            )
          })}
          <span className="mx-2 mt-2 block border-t" />
        </div>
      )}
      {items.map((n, i) => {
        if (!("href" in n)) {
          return compact ? (
            <span key={i} className="mx-2 my-2 border-t" />
          ) : (
            <p key={i} className="px-2 pt-4 pb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t(n.group)}
            </p>
          )
        }
        const kids = n.children?.filter((c) => allowed(c.perm))
        const active = itemActive(n)
        const base = "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        const activeCls = "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent"

        // plain link, or a group shown as a single icon in the narrow rail
        if (!kids || kids.length === 0 || compact) {
          const target = kids?.[0]?.href ?? n.href
          return (
            <div key={n.href} className="group/row relative">
              <Link href={target} onClick={onNavigate} title={compact ? t(n.label) : undefined} className={cn(base, !compact && "pr-8", active && activeCls)}>
                <n.icon className="size-4 shrink-0" />
                {!compact && t(n.label)}
              </Link>
              {!compact && star(target)}
            </div>
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
                  <li key={c.href} className="group/row relative">
                    <Link
                      href={c.href}
                      onClick={onNavigate}
                      aria-current={childActive(n, c) ? "page" : undefined}
                      className={cn(
                        "block truncate rounded-md px-2.5 py-1.5 pr-8 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground",
                        childActive(n, c) && "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent",
                      )}
                    >
                      {t(c.label)}
                    </Link>
                    {star(c.href)}
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

export function AppShell({ user, company, logoUrl, initialPinned, initialFavorites, notice, children }: { user: U; company: string; logoUrl: string; initialPinned: boolean; initialFavorites: string[]; notice?: React.ReactNode; children: React.ReactNode }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(initialPinned)
  // favourite links, saved on the user's account
  const [favs, setFavs] = useState<string[]>(initialFavorites)
  const toggleFav = (href: string) => {
    const next = favs.includes(href) ? favs.filter((h) => h !== href) : [...favs, href]
    setFavs(next)
    void saveFavorites(next)
  }
  // one-time move of favourites that were saved in this browser, if the account has none yet
  useEffect(() => {
    try {
      const old = localStorage.getItem(LEGACY_FAV_KEY)
      if (old === null) return
      localStorage.removeItem(LEGACY_FAV_KEY)
      const v = JSON.parse(old)
      if (initialFavorites.length === 0 && Array.isArray(v)) {
        const list = v.filter((x): x is string => typeof x === "string")
        if (list.length) {
          setFavs(list)
          void saveFavorites(list)
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [hover, setHover] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const expanded = pinned || hover
  const canSeeAlerts = can(user, "alerts.view")

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
            <Link href="/" className="min-w-0 rounded-lg hover:opacity-80" title={t("nav.dashboard")}>
              <Brand company={company} logoUrl={logoUrl} compact={!expanded} />
            </Link>
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
          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
            <Nav perms={user.perms} favs={favs} onToggleFav={toggleFav} compact={!expanded} />
          </div>
        </div>
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex w-64 flex-col p-3">
          <SheetTitle className="sr-only">{t("nav.navigation")}</SheetTitle>
          <div className="mb-4 px-0.5">
            <Link href="/" onClick={() => setOpen(false)} className="block rounded-lg hover:opacity-80" title={t("nav.dashboard")}>
              <Brand company={company} logoUrl={logoUrl} />
            </Link>
          </div>
          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
            <Nav perms={user.perms} favs={favs} onToggleFav={toggleFav} onNavigate={() => setOpen(false)} />
          </div>
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
              <p className="text-xs text-muted-foreground">{user.roleIsSystem ? t(`role.${user.role}`) : user.roleName}</p>
            </div>
          </div>
          <SignOutButton iconOnly />
        </header>
        {notice}
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
