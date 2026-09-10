"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardHeader, CardContent } from "@/lib/ui/card";
import { EmptyState, LoadError, PageLoader } from "@/lib/ui/complaint-list";
import { useToast } from "@/lib/ui/toast";
import { timeAgo } from "@/lib/format";
import { Bell, BellOff, CheckCheck } from "lucide-react";

type Notif = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  complaint_id: string | null;
  ticket_no?: string | null;
  read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const { status } = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const [notifs, setNotifs] = useState<Notif[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/notifications");
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load notifications.");
      setNotifs(data.notifs || []);
    } catch (e: any) {
      setError(e.message || "Unable to load notifications.");
    }
  }, [router]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated") load();
  }, [status, router, load]);

  async function markAll() {
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (res.ok) {
      setNotifs((n) => (n || []).map((x) => ({ ...x, read: true })));
      showToast("All notifications marked as read.", "success");
    } else {
      showToast("Could not mark notifications as read.", "error");
    }
  }

  async function open(n: Notif) {
    if (!n.read) {
      await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id }) });
    }
    if (n.complaint_id) router.push(`/complaints/${n.complaint_id}`);
    else load();
  }

  if (status !== "authenticated") return <PageLoader label="Checking your session…" />;

  const unread = (notifs || []).filter((n) => !n.read).length;

  return (
    <main className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto ai-hero-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span className="bounce-soft inline-flex"><Bell size={20} className="text-red-600 dark:text-red-400" /></span>
            <span className="gradient-shift">Notifications</span>
            {unread > 0 && (
              <span className="heartbeat inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold">{unread}</span>
            )}
          </h1>
          <p className="text-sm text-muted">{unread > 0 ? `${unread} unread notification${unread === 1 ? "" : "s"}.` : "You're all caught up."}</p>
        </div>
        {unread > 0 && (
          <button onClick={markAll} className="btn-shimmer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-app bg-surface text-sm font-medium text-foreground hover:bg-surface-2 hover:scale-105 active:scale-95 transition-all">
            <CheckCheck size={15} /> Mark all read
          </button>
        )}
      </div>

      <Card>
        <CardContent className="p-0 divide-y divide-[var(--border)]">
          {error ? (
            <LoadError message={error} onRetry={load} />
          ) : notifs === null ? (
            <PageLoader label="Loading notifications…" />
          ) : notifs.length === 0 ? (
            <EmptyState title="No notifications" hint="Updates about your complaints and assignments will appear here." />
          ) : (
            notifs.map((n, i) => (
              <button key={n.id} onClick={() => open(n)} style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }} className={`ai-msg-in w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-red-50/60 dark:hover:bg-red-950/30 hover:pl-5 transition-all ${!n.read ? "bg-red-50/60 dark:bg-red-500/5" : ""}`}>
                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.read ? "bg-transparent" : "bg-red-600 heartbeat"}`} />
                <span className={`shrink-0 mt-0.5 ${n.read ? "text-muted" : "text-red-500 jiggle"}`}>{n.read ? <BellOff size={16} /> : <Bell size={16} />}</span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`text-sm ${n.read ? "text-foreground" : "font-semibold text-foreground"}`}>{n.title}</span>
                    <span className="text-[11px] text-muted whitespace-nowrap">{timeAgo(n.created_at)}</span>
                  </span>
                  {n.message && <span className="block text-xs text-muted mt-0.5 line-clamp-2">{n.message}</span>}
                  {n.ticket_no && <span className="block text-[11px] font-mono text-red-600 dark:text-red-400 mt-1">{n.ticket_no}</span>}
                </span>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted text-center">
        Tip: click a notification to jump straight to the related complaint.{" "}
        <Link href="/dashboard" className="text-red-600 dark:text-red-400 hover:underline">Back to dashboard</Link>
      </p>
    </main>
  );
}
