"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardHeader, CardContent } from "@/lib/ui/card";
import { ComplaintTable, EmptyState, LoadError, PageLoader, type ComplaintItem } from "@/lib/ui/complaint-list";
import { NewComplaintButton } from "@/lib/ui/new-complaint";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;

export default function MyComplaintsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<ComplaintItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setError(null);
    try {
      const res = await fetch(`/api/complaints?page=${p}&pageSize=${PAGE_SIZE}&sort=newest`);
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load your complaints.");
      setItems(data.items || []);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
      setPage(data.page || p);
    } catch (e: any) {
      setError(e.message || "Unable to load your complaints.");
    }
  }, [router]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated") load(1);
  }, [status, router, load]);

  if (status !== "authenticated") return <PageLoader label="Checking your session…" />;

  return (
    <main className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto ai-hero-in relative">
      <div className="float-blobs" aria-hidden>
        <span className="float-blob h-44 w-44 -top-10 left-1/3" style={{ background: "#fca5a5" }} />
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap relative">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span className="bounce-soft inline-flex"><FileText size={20} className="text-red-600 dark:text-red-400" /></span>
            <span className="gradient-shift">My Complaints</span>
          </h1>
          <p className="text-sm text-muted">All complaints you have submitted, with live status and SLA tracking.</p>
        </div>
        <span className="jiggle inline-flex"><NewComplaintButton onCreated={() => load(page)} /></span>
      </div>

      <Card>
        <CardHeader title={`${total} complaint${total === 1 ? "" : "s"}`} subtitle={`Page ${page} of ${pages}`} />
        <CardContent className="p-0">
          {error ? (
            <LoadError message={error} onRetry={() => load(page)} />
          ) : items === null ? (
            <PageLoader label="Loading complaints…" />
          ) : items.length === 0 ? (
            <EmptyState
              title="You haven't submitted any complaints yet"
              hint="Create your first complaint — the AI engine will classify its category and priority and route it to the right department automatically."
              action={<NewComplaintButton onCreated={() => load(page)} />}
            />
          ) : (
            <>
              <ComplaintTable items={items} />
              {pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-app">
                  <button
                    onClick={() => load(page - 1)}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-app text-sm text-muted hover:bg-surface-2 disabled:opacity-40"
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <span className="text-xs text-muted">Page {page} of {pages}</span>
                  <button
                    onClick={() => load(page + 1)}
                    disabled={page >= pages}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-app text-sm text-muted hover:bg-surface-2 disabled:opacity-40"
                  >
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
