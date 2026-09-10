import { redirect } from "next/navigation";
import { getSession } from "@/lib/api-helpers";
import { collections, ensureMongoDb } from "@/lib/mongodb";
import { Card, CardHeader, CardContent, StatCard } from "@/lib/ui/card";
import { BarChart, DonutChart, LineChart, ProgressBar, type ChartDatum } from "@/lib/ui/charts";
import { PageLoader } from "@/lib/ui/skeleton";
import { BarChart3 } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "USER") redirect("/dashboard");

  let stats: any = null;
  let error: string | null = null;
  try {
    await ensureMongoDb();
    const { complaints } = await collections();

    const [byStatus, byPriority, byCategory, trend, totalsArr] = await Promise.all([
      complaints
        .aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }, { $sort: { n: -1 as const } }])
        .toArray(),
      complaints
        .aggregate([{ $group: { _id: "$priority", n: { $sum: 1 } } }, { $sort: { n: -1 as const } }])
        .toArray(),
      complaints
        .aggregate([
          { $lookup: { from: "categories", localField: "category_id", foreignField: "id", as: "_cat" } },
          { $addFields: { label: { $ifNull: [{ $arrayElemAt: ["$_cat.name", 0] }, "Uncategorised"] } } },
          { $unset: "_cat" },
          { $group: { _id: "$label", n: { $sum: 1 } } },
          { $sort: { n: -1 as const } },
          { $limit: 8 },
        ])
        .toArray(),
      complaints
        .aggregate([
          { $match: { created_at: { $gte: new Date(Date.now() - 13 * 86400000) } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
              n: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 as const } },
        ])
        .toArray(),
      complaints
        .aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              open: { $sum: { $cond: [{ $not: [{ $in: ["$status", ["RESOLVED", "CLOSED"]] }] }, 1, 0] } },
              breached: {
                $sum: {
                  $cond: [
                    { $and: [
                      { $lt: ["$sla_deadline", new Date()] },
                      { $not: [{ $in: ["$status", ["RESOLVED", "CLOSED"]] }] },
                    ] },
                    1, 0,
                  ],
                },
              },
              resolved: { $sum: { $cond: [{ $in: ["$status", ["RESOLVED", "CLOSED"]] }, 1, 0] } },
              avg_resolution_h: {
                $avg: {
                  $cond: [
                    { $ne: ["$resolved_at", null] },
                    { $divide: [{ $subtract: ["$resolved_at", "$created_at"] }, 3600000] },
                    null,
                  ],
                },
              },
            },
          },
        ])
        .toArray(),
    ]);

    // Fill the 14-day trend with zero-count days (mirrors the old generate_series).
    const trendMap = new Map(trend.map((r: any) => [r._id, r.n]));
    const trendRows: { label: string; n: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      trendRows.push({
        label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        n: trendMap.get(key) || 0,
      });
    }

    stats = {
      byStatus: byStatus.map((r: any) => ({ status: r._id, n: r.n })),
      byPriority: byPriority.map((r: any) => ({ priority: r._id, n: r.n })),
      byCategory: byCategory.map((r: any) => ({ label: r._id, n: r.n })),
      trend: trendRows,
      totals: totalsArr[0] || { total: 0, open: 0, breached: 0, resolved: 0, avg_resolution_h: null },
    };
  } catch (e) {
    console.error("[analytics]", e);
    error = "Unable to load analytics. Is the database running?";
  }

  if (error) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <Card><CardContent><p className="text-sm text-red-600 dark:text-red-400">{error}</p></CardContent></Card>
      </main>
    );
  }
  if (!stats) return <PageLoader label="Loading analytics…" />;

  const t = stats.totals;
  const resolutionRate = t.total > 0 ? (t.resolved / t.total) * 100 : 0;

  return (
    <main className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto ai-hero-in relative">
      <div className="float-blobs" aria-hidden>
        <span className="float-blob h-56 w-56 -top-16 -left-16" style={{ background: "#fca5a5" }} />
        <span className="float-blob h-48 w-48 top-24 right-0" style={{ background: "#fda4af", animationDelay: "-5s" }} />
      </div>
      <div className="relative">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <span className="bounce-soft inline-flex"><BarChart3 size={20} className="text-red-600 dark:text-red-400" /></span>
          <span className="gradient-shift">Analytics</span>
        </h1>
        <p className="text-sm text-muted">Complaint volume, classification mix and SLA health across everything visible to your role.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative stagger-children">
        <div className="card-shine rounded-2xl"><StatCard label="Total complaints" value={t.total} /></div>
        <div className="card-shine rounded-2xl"><StatCard label="Open" value={t.open} accent="text-red-600 dark:text-red-400" /></div>
        <div className="card-shine rounded-2xl"><StatCard label="SLA breached" value={t.breached} accent="text-red-600 dark:text-red-400" /></div>
        <div className="card-shine rounded-2xl"><StatCard label="Avg resolution" value={`${Math.round((t.avg_resolution_h || 0) * 10) / 10}h`} accent="text-emerald-600 dark:text-emerald-400" /></div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 relative stagger-children">
        <div className="card-shine rounded-2xl"><Card>
          <CardHeader title="Complaints per day" subtitle="Last 14 days" />
          <CardContent>
            <LineChart data={(stats.trend || []).map((r: any) => ({ label: r.label, value: r.n }))} />
          </CardContent>
        </Card></div>
        <div className="card-shine rounded-2xl"><Card>
          <CardHeader title="Status mix" subtitle="All complaints" />
          <CardContent className="flex justify-center">
            <DonutChart data={(stats.byStatus || []).map((r: any) => ({ label: r.status, value: r.n }))} />
          </CardContent>
        </Card></div>
        <div className="card-shine rounded-2xl"><Card>
          <CardHeader title="Top categories" subtitle="By complaint count" />
          <CardContent>
            <BarChart data={(stats.byCategory || []).map((r: any) => ({ label: r.label, value: r.n }))} />
          </CardContent>
        </Card></div>
        <div className="card-shine rounded-2xl"><Card>
          <CardHeader title="Priority mix & resolution rate" />
          <CardContent className="space-y-4">
            {(stats.byPriority || []).map((r: any) => (
              <ProgressBar key={r.priority} label={r.priority} value={t.total ? (r.n / t.total) * 100 : 0} tone={r.priority === "CRITICAL" ? "red" : r.priority === "HIGH" ? "amber" : "indigo"} />
            ))}
            <ProgressBar label="Resolution rate" value={resolutionRate} tone="emerald" />
          </CardContent>
        </Card></div>
      </div>
    </main>
  );
}
