"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardHeader, CardContent } from "@/lib/ui/card";
import { StatusBadge, PriorityBadge, Badge } from "@/lib/ui/badge";
import { LoadError, PageLoader } from "@/lib/ui/complaint-list";
import { useToast } from "@/lib/ui/toast";
import { cn, formatDateTime, formatSlaRemaining, initials, timeAgo } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/ui/common";
import { ArrowLeft, Send, Bot, UserPlus, ArrowUpRight, MessageSquare, History, ShieldAlert } from "lucide-react";

type Detail = {
  complaint: any;
  messages: any[];
  events: any[];
  attachments?: any[];
  classifications?: any[];
  feedback?: any;
  aiFeedback?: any;
  viewer: { id: string; role: string };
};

const TRANSITIONS: Record<string, string[]> = {
  NEW: ["ASSIGNED", "IN_PROGRESS"],
  AI_ANALYZED: ["ASSIGNED", "IN_PROGRESS"],
  ASSIGNED: ["IN_PROGRESS", "WAITING", "ESCALATED", "RESOLVED"],
  IN_PROGRESS: ["WAITING", "ESCALATED", "RESOLVED", "ASSIGNED"],
  WAITING: ["IN_PROGRESS", "ESCALATED", "RESOLVED"],
  ESCALATED: ["IN_PROGRESS", "RESOLVED", "ASSIGNED"],
  REOPENED: ["IN_PROGRESS", "ASSIGNED", "ESCALATED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
};

export default function ComplaintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { status } = useSession();
  const { showToast } = useToast();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/complaints/${id}`);
      if (res.status === 401) return router.replace("/login");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Unable to load this complaint.");
      setData(d);
    } catch (e: any) {
      setError(e.message || "Unable to load this complaint.");
    }
  }, [id, router]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated") load();
  }, [status, router, load]);

  async function post(url: string, body: unknown, successMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(d.error || "Action failed.", "error");
        return false;
      }
      showToast(successMsg, "success");
      await load();
      return true;
    } catch {
      showToast("Network error — please try again.", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function patch(body: unknown, successMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/complaints/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(d.error || "Action failed.", "error");
        return;
      }
      showToast(successMsg, "success");
      await load();
    } catch {
      showToast("Network error — please try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (status !== "authenticated") return <PageLoader label="Checking your session…" />;
  if (error) return <main className="p-6 max-w-4xl mx-auto"><Card><LoadError message={error} onRetry={load} /></Card></main>;
  if (!data) return <PageLoader label="Loading complaint…" />;

  const c = data.complaint;
  const isStaff = data.viewer.role !== "USER";
  const isMine = c.user_id === data.viewer.id;
  const sla = formatSlaRemaining(c.sla_deadline);
  const nexts = (TRANSITIONS[c.status] || []).filter((s) => s !== "REOPENED" || !isStaff);
  const canReply = isStaff || isMine;

  return (
    <main className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <Link href={isStaff ? "/complaints" : "/my-complaints"} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={15} /> Back to complaints
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold text-red-600 dark:text-red-400">{c.ticket_no}</p>
          <h1 className="text-xl font-bold text-foreground mt-0.5">{c.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <StatusBadge status={c.status} />
            <PriorityBadge priority={c.priority} />
            {c.category_name && <Badge className="bg-surface-2 text-muted border border-app">{c.category_name}</Badge>}
            {c.department_name && <Badge className="bg-surface-2 text-muted border border-app">{c.department_name}</Badge>}
            {c.sla_state === "breached" && <Badge className="bg-red-600 text-white">SLA breached</Badge>}
          </div>
        </div>
        <div className="text-right">
          <p className={cn("text-sm font-semibold", sla.state === "breach" ? "text-red-600 dark:text-red-400" : sla.state === "warn" ? "text-amber-600 dark:text-amber-400" : "text-muted")}>
            {["RESOLVED", "CLOSED"].includes(c.status) ? "SLA closed" : `SLA: ${sla.text}`}
          </p>
          <p className="text-xs text-muted mt-1">Created {timeAgo(c.created_at)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader title="Description" />
            <CardContent className="text-sm text-foreground whitespace-pre-wrap">{c.description}</CardContent>
            {c.additional_info && (
              <CardContent className="pt-0">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Additional info</p>
                <p className="text-sm text-muted whitespace-pre-wrap">{c.additional_info}</p>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><Bot size={16} className="text-red-600 dark:text-red-400" /> AI classification</span>}
              subtitle={`Source: ${String(c.classification_source || "AI_GENERATED").replace("_", " ")} · ${Math.round((c.ai_confidence || 0) * 100)}% confidence`}
            />
            <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted">Category</p><p className="font-medium">{c.ai_subcategory ? `${c.category_name || "—"} · ${c.ai_subcategory}` : c.category_name || "—"}</p></div>
              <div><p className="text-xs text-muted">AI priority / severity</p><p className="font-medium">{c.ai_priority || "—"} · {c.ai_severity || "—"}</p></div>
              <div><p className="text-xs text-muted">Sentiment</p><p className="font-medium">{c.ai_sentiment || "—"}</p></div>
              <div><p className="text-xs text-muted">Needs human review</p><p className="font-medium">{c.needs_human_review ? (c.review_status === "AWAITING" ? "Yes — awaiting review" : `Yes — ${c.review_status}`) : "No"}</p></div>
              {c.ai_suggested_resolution && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted">Suggested resolution</p>
                  <p className="mt-1 rounded-lg bg-surface-2 border border-app p-2.5 text-xs text-foreground whitespace-pre-wrap">{c.ai_suggested_resolution}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><MessageSquare size={16} /> Conversation</span>} subtitle={`${data.messages.length} message${data.messages.length === 1 ? "" : "s"}`} />
            <CardContent className="space-y-3">
              {data.messages.length === 0 && <p className="text-sm text-muted">No messages yet.</p>}
              {data.messages.map((m) => {
                const mine = m.author_id === data.viewer.id;
                return (
                  <div key={m.id} className={cn("flex gap-2.5", mine && "flex-row-reverse")}>
                    <span className="h-8 w-8 shrink-0 rounded-full bg-red-600/90 text-white text-[11px] font-bold flex items-center justify-center">{initials(m.author_name)}</span>
                    <div className={cn("max-w-[80%] rounded-xl border border-app px-3 py-2", mine ? "bg-red-600/10" : "bg-surface-2", m.is_internal && "border-amber-400 bg-amber-50 dark:bg-amber-500/10")}>
                      <p className="text-[11px] text-muted flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">{m.author_name}</span>
                        {m.is_internal && <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Internal note</Badge>}
                        · {formatDateTime(m.created_at)}
                      </p>
                      <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
            {canReply && (
              <CardContent className="border-t border-app space-y-2">
                <textarea
                  className="w-full rounded-lg border border-app bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-red-500/50 min-h-[70px] resize-y"
                  placeholder={isStaff ? "Reply to the customer…" : "Add a reply to the support team…"}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  maxLength={4000}
                />
                <div className="flex items-center justify-between gap-2">
                  {isStaff ? (
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="accent-red-600" />
                      Internal note (hidden from customer)
                    </label>
                  ) : <span />}
                  <button
                    onClick={async () => {
                      if (!reply.trim()) return;
                      const okDone = await post(`/api/complaints/${id}/messages`, { content: reply.trim(), isInternal }, "Message sent.");
                      if (okDone) setReply("");
                    }}
                    disabled={busy || !reply.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50"
                  >
                    <Send size={14} /> Send
                  </button>
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><History size={16} /> Activity</span>} subtitle={`${data.events.length} event${data.events.length === 1 ? "" : "s"}`} />
            <CardContent className="space-y-0">
              {data.events.length === 0 && <p className="text-sm text-muted">No activity recorded.</p>}
              {data.events.map((e) => (
                <div key={e.id} className="flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 mt-1.5" />
                    <span className="flex-1 w-px bg-[var(--border)] mt-1" />
                  </div>
                  <div className="pb-1">
                    <p className="text-sm font-medium text-foreground">{e.title}</p>
                    {e.description && <p className="text-xs text-muted mt-0.5">{e.description}</p>}
                    <p className="text-[11px] text-muted mt-0.5">{e.actor_name || "System"} · {formatDateTime(e.created_at)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Details" />
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-2"><span className="text-muted">Customer</span><span className="font-medium text-right">{c.customer_name || "—"}<span className="block text-[11px] text-muted font-normal">{c.customer_email}</span></span></div>
              <div className="flex justify-between gap-2"><span className="text-muted">Assigned agent</span><span className="font-medium">{c.agent_name || "Unassigned"}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted">Department</span><span className="font-medium">{c.department_name || "—"}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted">Location</span><span className="font-medium">{c.location || "—"}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted">SLA deadline</span><span className="font-medium">{formatDateTime(c.sla_deadline)}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted">Resolved at</span><span className="font-medium">{formatDateTime(c.resolved_at)}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted">Created</span><span className="font-medium">{formatDateTime(c.created_at)}</span></div>
            </CardContent>
          </Card>

          {isStaff && (
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><ShieldAlert size={16} /> Actions</span>} subtitle="Workflow actions for staff" />
              <CardContent className="space-y-3 text-sm">
                {(!c.assigned_agent_id || ["NEW", "AI_ANALYZED", "REOPENED", "ESCALATED"].includes(c.status)) && (
                  <button
                    onClick={() => post(`/api/complaints/${id}/assign`, { agentId: data.viewer.id }, "Complaint accepted into your queue.")}
                    disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white font-medium disabled:opacity-50"
                  >
                    <UserPlus size={15} /> Accept (assign to me)
                  </button>
                )}
                {nexts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Change status</p>
                    <div className="flex flex-wrap gap-1.5">
                      {nexts.map((s) => (
                        <button
                          key={s}
                          onClick={() => patch({ action: "status", status: s }, `Status changed to ${STATUS_LABELS[s] || s}.`)}
                          disabled={busy}
                          className="px-2.5 py-1.5 rounded-lg border border-app text-xs font-medium text-foreground hover:bg-surface-2 disabled:opacity-50"
                        >
                          → {STATUS_LABELS[s] || s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {c.status !== "ESCALATED" && !["RESOLVED", "CLOSED"].includes(c.status) && (
                  <button
                    onClick={() => post(`/api/complaints/${id}/escalate`, { reason: "Manually escalated by staff" }, "Complaint escalated.")}
                    disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white font-medium disabled:opacity-50"
                  >
                    <ArrowUpRight size={15} /> Escalate
                  </button>
                )}
                {["MANAGER", "ADMIN"].includes(data.viewer.role) && (
                  <div>
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Priority override</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((p) => (
                        <button
                          key={p}
                          onClick={() => patch({ action: "priority", priority: p }, `Priority set to ${p}.`)}
                          disabled={busy || c.priority === p}
                          className="px-2.5 py-1.5 rounded-lg border border-app text-xs font-medium text-foreground hover:bg-surface-2 disabled:opacity-40"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {data.feedback && (
            <Card>
              <CardHeader title="Customer feedback" subtitle={`Rated ${data.feedback.rating}/5`} />
              <CardContent className="text-sm">
                <p className="text-amber-500 tracking-widest">{"★".repeat(data.feedback.rating)}{"☆".repeat(Math.max(0, 5 - data.feedback.rating))}</p>
                {data.feedback.comment && <p className="text-muted mt-1.5">{data.feedback.comment}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
