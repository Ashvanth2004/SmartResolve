import { redirect } from "next/navigation";
import { getSession } from "@/lib/api-helpers";
import { collections, ensureMongoDb } from "@/lib/mongodb";
import { Card, CardHeader, CardContent } from "@/lib/ui/card";
import { StatusBadge, PriorityBadge, Badge } from "@/lib/ui/badge";
import { Bot, Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "AI Review" };

/** Complaints the AI flagged for human review (low classification confidence). */
export default async function AiReviewPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "USER") redirect("/dashboard");

  let rows: any[] = [];
  let error: string | null = null;
  try {
    await ensureMongoDb();
    const { complaints } = await collections();
    rows = await complaints
      .aggregate([
        { $match: { needs_human_review: true, review_status: "AWAITING" } },
        { $sort: { ai_confidence: 1 as const, created_at: -1 as const } },
        { $limit: 50 },
        { $lookup: { from: "categories", localField: "category_id", foreignField: "id", as: "_cat" } },
        { $lookup: { from: "departments", localField: "department_id", foreignField: "id", as: "_dept" } },
        { $lookup: { from: "users", localField: "user_id", foreignField: "id", as: "_u" } },
        {
          $addFields: {
            category_name: { $arrayElemAt: ["$_cat.name", 0] },
            department_name: { $arrayElemAt: ["$_dept.name", 0] },
            customer_name: { $arrayElemAt: ["$_u.name", 0] },
          },
        },
        { $unset: ["_cat", "_dept", "_u"] },
      ])
      .toArray();
  } catch (e) {
    console.error("[ai-review]", e);
    error = "Unable to load the review queue. Is the database running?";
  }

  return (
    <main className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto ai-hero-in relative">
      <div className="float-blobs" aria-hidden>
        <span className="float-blob h-44 w-44 -top-10 right-10" style={{ background: "#fecaca" }} />
      </div>
      <div className="relative">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <span className="bounce-soft inline-flex"><Bot size={20} className="text-red-600 dark:text-red-400" /></span>
          <span className="gradient-shift">AI Review</span>
          {rows.length > 0 && (
            <span className="heartbeat inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">{rows.length}</span>
          )}
        </h1>
        <p className="text-sm text-muted">Complaints the AI classified below the confidence threshold and flagged for human review.</p>
      </div>

      {error ? (
        <Card><CardContent><p className="text-sm text-red-600 dark:text-red-400">{error}</p></CardContent></Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-14 text-center">
            <Inbox size={28} className="text-muted mb-2" />
            <p className="font-semibold text-foreground">Review queue is empty</p>
            <p className="text-sm text-muted mt-1">Every AI classification is currently above the confidence threshold. Great!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {rows.map((c) => (
            <Card key={c.id}>
              <CardHeader
                title={
                  <a href={`/complaints/${c.id}`} className="hover:text-red-600 dark:hover:text-red-400">
                    <span className="font-mono text-xs text-red-600 dark:text-red-400">{c.ticket_no}</span>
                    <span className="block">{c.title}</span>
                  </a>
                }
                subtitle={`${c.customer_name || "—"} · ${new Date(c.created_at).toLocaleDateString("en-GB")}`}
              />
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={c.status} />
                  <PriorityBadge priority={c.priority} />
                  {c.category_name && <Badge className="bg-surface-2 text-muted border border-app">{c.category_name}</Badge>}
                  {c.department_name && <Badge className="bg-surface-2 text-muted border border-app">{c.department_name}</Badge>}
                </div>
                <p className="text-xs text-muted">
                  AI confidence <span className="font-semibold text-foreground">{Math.round((c.ai_confidence || 0) * 100)}%</span>
                </p>
                {c.ai_suggested_resolution && <p className="text-xs text-muted line-clamp-3">{c.ai_suggested_resolution}</p>}
                <a href={`/complaints/${c.id}`} className="inline-block text-xs font-medium text-red-600 dark:text-red-400 hover:underline">
                  Open ticket →
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
