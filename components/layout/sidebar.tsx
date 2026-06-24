"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, MessageSquare, LayoutDashboard, Database, BookOpen, Bell, History, Settings, LogOut, ChevronDown } from "lucide-react";
import { PulseMark } from "./logo";
import { cn, initials } from "@/lib/utils";

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/ask", label: "Ask", icon: MessageSquare },
  { href: "/dashboards", label: "Dashboards", icon: LayoutDashboard },
  { href: "/data-sources", label: "Data Sources", icon: Database },
  { href: "/semantic-layer", label: "Semantic Layer", icon: BookOpen },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/history", label: "Query History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ workspace, user }: { workspace: { name: string } | null; user: { name: string | null; email: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = React.useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-surface/60">
      <div className="flex items-center gap-2 px-4 py-4">
        <PulseMark className="size-7" />
        <span className="text-[15px] font-semibold tracking-tight">Pulse</span>
      </div>

      <div className="relative px-3">
        <button
          onClick={() => setMenu((m) => !m)}
          className="flex w-full items-center justify-between rounded-md border border-border bg-card px-2.5 py-2 text-left hover:border-border-strong"
        >
          <span className="flex items-center gap-2 truncate">
            <span className="flex size-6 items-center justify-center rounded bg-gradient-to-br from-primary/80 to-accent/80 text-[10px] font-bold text-white">
              {initials(workspace?.name ?? "W")}
            </span>
            <span className="truncate text-xs font-medium">{workspace?.name ?? "Workspace"}</span>
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
        {menu && (
          <div className="absolute left-3 right-3 z-20 mt-1 rounded-md border border-border bg-popover p-1 shadow-xl">
            <div className="px-2 py-1.5 text-[11px] text-muted-foreground">{user.email}</div>
            <button onClick={logout} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-foreground hover:bg-muted">
              <LogOut className="size-3.5" /> Sign out
            </button>
          </div>
        )}
      </div>

      <nav className="mt-3 flex flex-1 flex-col gap-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className={cn("size-4", active && "text-primary")} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-md px-1 py-1">
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
            {initials(user.name ?? user.email)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-medium">{user.name ?? "Operator"}</div>
            <div className="truncate text-[11px] text-muted-foreground">{user.email}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
