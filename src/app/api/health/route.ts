import { NextResponse } from "next/server";
import { getDb, collections, ensureMongoDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  const results: Record<string, any> = {};

  // 1. Raw MongoDB connection
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    results.mongoConnection = { ok: true, latencyMs: Date.now() - start };
  } catch (e: any) {
    results.mongoConnection = { ok: false, error: e.message };
  }

  // 2. ensureMongoDb (indexes + seed)
  const t2 = Date.now();
  try {
    await ensureMongoDb();
    results.ensureMongoDb = { ok: true, latencyMs: Date.now() - t2 };
  } catch (e: any) {
    results.ensureMongoDb = { ok: false, error: e.message };
  }

  // 3. Collection counts
  const t3 = Date.now();
  try {
    const c = await collections();
    const [users, departments, categories, complaints, sla_rules] = await Promise.all([
      c.users.countDocuments({}),
      c.departments.countDocuments({}),
      c.categories.countDocuments({}),
      c.complaints.countDocuments({}),
      c.sla_rules.countDocuments({}),
    ]);
    results.collectionCounts = {
      ok: true,
      latencyMs: Date.now() - t3,
      data: { users, departments, categories, complaints, sla_rules },
    };
  } catch (e: any) {
    results.collectionCounts = { ok: false, error: e.message };
  }

  // 4. Users list (names + roles only - no passwords)
  const t4 = Date.now();
  try {
    const c = await collections();
    const users = await c.users
      .find({}, { projection: { _id: 0, id: 1, name: 1, email: 1, role: 1, department_id: 1 } })
      .sort({ role: 1 })
      .toArray();
    results.users = { ok: true, latencyMs: Date.now() - t4, data: users };
  } catch (e: any) {
    results.users = { ok: false, error: e.message };
  }

  // 5. Complaints sample (latest 5)
  const t5 = Date.now();
  try {
    const c = await collections();
    const complaints = await c.complaints
      .find({}, { projection: { _id: 0, id: 1, ticket_no: 1, title: 1, status: 1, priority: 1, created_at: 1 } })
      .sort({ created_at: -1 })
      .limit(5)
      .toArray();
    results.recentComplaints = { ok: true, latencyMs: Date.now() - t5, data: complaints };
  } catch (e: any) {
    results.recentComplaints = { ok: false, error: e.message };
  }

  // 6. Analytics aggregation (the previously broken one)
  const t6 = Date.now();
  try {
    const c = await collections();
    const totals = await c.complaints
      .aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            open: { $sum: { $cond: [{ $not: [{ $in: ["$status", ["RESOLVED", "CLOSED"]] }] }, 1, 0] } },
            breached: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $lt: ["$sla_deadline", new Date()] },
                      { $not: [{ $in: ["$status", ["RESOLVED", "CLOSED"]] }] },
                    ],
                  },
                  1, 0,
                ],
              },
            },
            resolved: { $sum: { $cond: [{ $in: ["$status", ["RESOLVED", "CLOSED"]] }, 1, 0] } },
          },
        },
      ])
      .toArray();
    results.analyticsAggregation = { ok: true, latencyMs: Date.now() - t6, data: totals[0] || {} };
  } catch (e: any) {
    results.analyticsAggregation = { ok: false, error: e.message };
  }

  // 7. SLA rules
  const t7 = Date.now();
  try {
    const c = await collections();
    const slaRules = await c.sla_rules
      .find({}, { projection: { _id: 0, priority: 1, response_hours: 1, resolution_hours: 1 } })
      .toArray();
    results.slaRules = { ok: true, latencyMs: Date.now() - t7, data: slaRules };
  } catch (e: any) {
    results.slaRules = { ok: false, error: e.message };
  }

  const allOk = Object.values(results).every((r: any) => r.ok);
  return NextResponse.json(
    {
      success: allOk,
      totalLatencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
      tests: results,
    },
    { status: allOk ? 200 : 500 }
  );
}
