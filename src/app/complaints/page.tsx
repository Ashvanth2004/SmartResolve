"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardHeader, CardContent } from "@/lib/ui/card";
import { ComplaintTable, EmptyState, LoadError, PageLoader, type ComplaintItem } from "@/lib/ui/complaint-list";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/ui/common";
import { LifeBuoy, Search, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 12;
const inputCls =
  "rounded-lg border border-app bg-surface px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-red-500/50";

export default function ComplaintsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<ComplaintItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ q: "", status: "", priority: "", slaState: "", sort: "newest" });
  const [applied, setApplied] = useState(filters);

  const load = useCallback(async (p: number, f: typeof applied) => {
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE), sort: f.sort });
      if (f.q) qs.set("q", f.q);
      if (f.status) qs.set("status", f.status);
      if (f.priority) qs.set("priority", f.priority);
      if (f.slaState) qs.set("slaState", f.slaState);
      const res = await fetch(`/api/complaints?${qs.toString()}`);
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load complaints.");
      setItems(data.items || []);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
      setPage(data.page || p);
    } catch (e: any) {
      setError(e.message || "Unable to load complaints.");
    }
  }, [router]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated") load(1, applied);
  }, [status, router, load, applied]);

  if (status !== "authenticated") return <PageLoader label="Checking your session…" />;

  const setF = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <main className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto ai-hero-in">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <span className="bounce-soft inline-flex"><LifeBuoy size={20} className="text-red-600 dark:text-red-400" /></span>
          <span className="gradient-shift">Complaints</span>
        </h1>
        <p className="text-sm text-muted">All complaints visible to your role — search, filter and drill into any ticket.</p>
      </div>

      <Card>
        <CardHeader
          title={`${total} complaint${total === 1 ? "" : "s"}`}
          subtitle={`Page ${page} of ${pages}`}
          action={
            <button onClick={() => setApplied(filters)} className="btn-shimmer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 hover:scale-105 active:scale-95 transition-all">
              <Search size={13} /> Apply filters
            </button>
          }
        />
        <CardContent className="flex flex-wrap gap-2 border-b border-app">
          <input className={inputCls + " min-w-[200px] flex-1"} placeholder="Search title, ticket or people…" value={filters.q} onChange={setF("q")} onKeyDown={(e) => e.key === "Enter" && setApplied(filters)} />
          <select className={inputCls} value={filters.status} onChange={setF("status")}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className={inputCls} value={filters.priority} onChange={setF("priority")}>
            <option value="">All priorities</option>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className={inputCls} value={filters.slaState} onChange={setF("slaState")}>
            <option value="">Any SLA state</option>
            <option value="breached">Breached</option>
            <option value="approaching">Approaching</option>
            <option value="met">Met</option>
          </select>
          <select className={inputCls} value={filters.sort} onChange={setF("sort")}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="priority">Priority</option>
            <option value="sla">SLA deadline</option>
            <option value="updated">Recently updated</option>
          </select>
        </CardContent>
        <CardContent className="p-0">
          {error ? (
            <LoadError message={error} onRetry={() => load(page, applied)} />
          ) : items === null ? (
            <PageLoader label="Loading complaints…" />
          ) : items.length === 0 ? (
            <EmptyState title="No complaints match your filters" hint="Try clearing the search or choosing different filters." />
          ) : (
            <>
              <ComplaintTable items={items} showCustomer />
              {pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-app">
                  <button onClick={() => load(page - 1, applied)} disabled={page <= 1} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-app text-sm text-muted hover:bg-surface-2 disabled:opacity-40">
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <span className="text-xs text-muted">Page {page} of {pages}</span>
                  <button onClick={() => load(page + 1, applied)} disabled={page >= pages} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-app text-sm text-muted hover:bg-surface-2 disabled:opacity-40">
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
