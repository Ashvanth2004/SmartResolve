"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useTheme } from "@/app/providers";
import { Bell, Moon, Sun, Home, FileText, BarChart3, LifeBuoy } from "lucide-react";
import { AuroraBackdrop } from "@/lib/ui/ai-effects";

const NAV = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/complaints", label: "Complaints", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/support", label: "Support", icon: LifeBuoy },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    const load = () =>
      fetch("/api/notifications")
        .then((r) => (r.ok ? r.json() : { notifs: [] }))
        .then((d) => setUnread((d.notifs || []).filter((n: any) => !n.read).length))
        .catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [status]);

  const isAuthPage = pathname === "/login" || pathname === "/register" || pathname === "/forgot-password" || pathname === "/reset-password" || pathname === "/verify-email";
  if (isAuthPage) return <div className="min-h-screen bg-app">{children}</div>;

  const home = "/dashboard";

  const brand = (
    <Link href={home} className="flex items-center gap-2.5 px-2 group">
      <span className="bounce-soft inline-flex ai-orb ai-orb-sm h-9 w-9 group-hover:scale-110 transition-transform">
        <span className="ai-orb-core text-base">R</span>
        <span className="ai-orb-ring ai-orb-ring-1" />
        <span className="ai-orb-ring ai-orb-ring-2" />
      </span>
      <span className="text-[15px] font-bold tracking-tight">
        Resolve<span className="gradient-shift">AI</span>
        <span className="ml-1.5 hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 ai-live pulse-glow">
          <span className="h-1 w-1 rounded-full bg-emerald-500 heartbeat" /> AI live
        </span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-app">
      <AuroraBackdrop />
      {/* ── Minimal top bar ── */}
      <header className="glass sticky top-0 z-30 border-b border-app">
        <div className="flex items-center justify-between gap-3 px-3 sm:px-4 h-14">
          {brand}

          {/* ── Desktop nav ── */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main">
            {NAV.map(({ href, label }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                    active
                      ? "text-red-600 dark:text-red-400 bg-red-500/10"
                      : "text-muted hover:text-foreground hover:bg-surface-2"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            <button onClick={toggle} className="p-2 rounded-lg text-muted hover:bg-surface-2 hover:rotate-12 hover:scale-110 active:scale-95 transition-all duration-200" aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link href="/notifications" className="relative p-2 rounded-lg text-muted hover:bg-surface-2 hover:scale-110 active:scale-95 transition-all duration-200" aria-label="Notifications">
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-gradient-to-br from-rose-500 to-red-600 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow animate-bounce">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          </div>
        </div>
        {/* AI capability marquee */}
        <div className="ai-marquee border-t border-app/60 bg-surface/40 px-4 py-1">
          <div className="ai-marquee-track text-[10px] font-medium uppercase tracking-wider text-muted">
            {["Auto-classify complaints", "Priority detection", "Smart routing", "SLA guard", "Evidence research", "Sentiment sense", "Instant answers", "Human handoff"].concat(["Auto-classify complaints", "Priority detection", "Smart routing", "SLA guard", "Evidence research", "Sentiment sense", "Instant answers", "Human handoff"]).map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="h-1 w-1 rounded-full bg-gradient-to-br from-red-500 to-black" /> {c}
                <span className="mx-2 text-red-300 dark:text-red-700">✦</span>
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ── Page content (extra bottom padding on mobile for tab bar) ── */}
      <div className="pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">{children}</div>

      {/* ── Mobile bottom tab bar ── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-app flex items-stretch justify-around"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Mobile"
      >
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 flex-1 min-w-0 transition-colors duration-200 ${
                active ? "text-red-600 dark:text-red-400" : "text-muted active:bg-surface-2"
              }`}
            >
              <span className={`relative flex flex-col items-center ${active ? "-translate-y-0.5 transition-transform" : ""}`}>
                {active && <span className="absolute -top-2 h-0.5 w-6 rounded-full bg-gradient-to-r from-red-500 to-red-700 pop-in" />}
                <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
              </span>
              <span className="text-[10px] font-semibold tracking-tight">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}