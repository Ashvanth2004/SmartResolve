import { collections, ensureMongoDb } from "@/lib/mongodb";
import { slaStateOf, type SlaState } from "@/lib/sla";
import type { SessionUser } from "@/lib/api-helpers";

/** Mongo filter limiting complaint visibility by role (row-level authorisation). */
export function scopeFilter(user: SessionUser): Record<string, unknown> {
  switch (user.role) {
    case "ADMIN":
      return {};
    case "MANAGER":
      return { department_id: user.departmentId || "" };
    case "AGENT":
      return { $or: [{ assigned_agent_id: user.id }, { department_id: user.departmentId || "" }] };
    default:
      return { user_id: user.id };
  }
}

export type ListFilters = {
  q?: string | null;
  category?: string | null;
  priority?: string | null;
  status?: string | null; // "OPEN" = not resolved/closed
  department?: string | null;
  sentiment?: string | null;
  agent?: string | null; // agent id | "unassigned"
  slaState?: string | null; // breached | approaching | met
  dateFrom?: string | null;
  dateTo?: string | null;
  sort?: string | null;
  page?: number;
  pageSize?: number;
};

const OPEN_STATUSES = ["NEW", "AI_ANALYZED", "ASSIGNED", "IN_PROGRESS", "WAITING", "ESCALATED", "REOPENED"];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build the $match filter (joined with $and) for list filters. */
export async function filtersToMongo(f: ListFilters, scope: Record<string, unknown>): Promise<Record<string, unknown>> {
  const conds: Record<string, unknown>[] = [];
  if (f.q) {
    const rx = new RegExp(escapeRegex(f.q), "i");
    const qConds: Record<string, unknown>[] = [
      { title: rx }, { description: rx }, { ticket_no: rx },
    ];
    // Customer/agent names live in the users collection — resolve ids first.
    const { users } = await collections();
    const matched = await users.find({ name: rx }, { projection: { id: 1 } }).toArray();
    const ids = matched.map((u) => (u as any).id);
    if (ids.length > 0) {
      qConds.push({ user_id: { $in: ids } }, { assigned_agent_id: { $in: ids } });
    }
    conds.push({ $or: qConds });
  }
  if (f.category) conds.push({ category_id: f.category });
  if (f.priority) conds.push({ priority: f.priority });
  if (f.status === "OPEN") conds.push({ status: { $in: OPEN_STATUSES } });
  else if (f.status) conds.push({ status: f.status });
  if (f.department) conds.push({ department_id: f.department });
  if (f.sentiment) conds.push({ sentiment: f.sentiment });
  if (f.agent === "unassigned") conds.push({ assigned_agent_id: null });
  else if (f.agent) conds.push({ assigned_agent_id: f.agent });
  const now = new Date();
  if (f.slaState === "breached") conds.push({ sla_deadline: { $lt: now }, status: { $nin: ["RESOLVED", "CLOSED"] } });
  else if (f.slaState === "approaching") conds.push({ sla_deadline: { $gte: now, $lte: new Date(Date.now() + 2 * 3600000) }, status: { $nin: ["RESOLVED", "CLOSED"] } });
  else if (f.slaState === "met") conds.push({ status: { $in: ["RESOLVED", "CLOSED"] }, resolved_at: { $ne: null }, sla_deadline: { $ne: null }, $expr: { $lte: ["$resolved_at", "$sla_deadline"] } });
  if (f.dateFrom) conds.push({ created_at: { $gte: new Date(f.dateFrom) } });
  if (f.dateTo) {
    const d = new Date(f.dateTo);
    d.setDate(d.getDate() + 1);
    conds.push({ created_at: { $lt: d } });
  }
  if (conds.length === 0) return scope;
  return { $and: [scope, ...conds] };
}

const SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { created_at: -1 },
  oldest: { created_at: 1 },
  updated: { updated_at: -1 },
  sla: { sla_deadline: 1 },
};

export type ComplaintRow = Record<string, any> & { sla_state?: SlaState };

/** Aggregation stages joining category/department/customer/agent/feedback display fields. */
function lookupStages(): Record<string, unknown>[] {
  return [
    { $lookup: { from: "categories", localField: "category_id", foreignField: "id", as: "_cat" } },
    { $lookup: { from: "departments", localField: "department_id", foreignField: "id", as: "_dept" } },
    { $lookup: { from: "users", localField: "user_id", foreignField: "id", as: "_customer" } },
    { $lookup: { from: "users", localField: "assigned_agent_id", foreignField: "id", as: "_agent" } },
    { $lookup: { from: "feedback", localField: "id", foreignField: "complaint_id", as: "_fb" } },
    {
      $addFields: {
        category_name: { $arrayElemAt: ["$_cat.name", 0] },
        department_name: { $arrayElemAt: ["$_dept.name", 0] },
        customer_name: { $arrayElemAt: ["$_customer.name", 0] },
        customer_email: { $arrayElemAt: ["$_customer.email", 0] },
        agent_name: { $arrayElemAt: ["$_agent.name", 0] },
        feedback_rating: { $arrayElemAt: ["$_fb.rating", 0] },
        feedback_comment: { $arrayElemAt: ["$_fb.comment", 0] },
      },
    },
    { $unset: ["_cat", "_dept", "_customer", "_agent", "_fb"] },
  ];
}

function withSlaState(r: Record<string, any>): ComplaintRow {
  return {
    ...r,
    sla_state: slaStateOf(r.sla_deadline ? new Date(r.sla_deadline) : null, r.status),
  };
}

const PRIORITY_SORT_STAGES = [
  {
    $addFields: {
      priority_rank: {
        $switch: {
          branches: [
            { case: { $eq: ["$priority", "CRITICAL"] }, then: 0 },
            { case: { $eq: ["$priority", "HIGH"] }, then: 1 },
            { case: { $eq: ["$priority", "MEDIUM"] }, then: 2 },
          ],
          default: 3,
        },
      },
    },
  },
];

/** Paginated, filtered, role-scoped complaint list. */
export async function listComplaints(
  user: SessionUser,
  f: ListFilters
): Promise<{ items: ComplaintRow[]; total: number; page: number; pageSize: number; pages: number }> {
  await ensureMongoDb();
  const scope = scopeFilter(user);
  const match = await filtersToMongo(f, scope);
  const page = Math.max(1, f.page || 1);
  const pageSize = Math.min(50, Math.max(5, f.pageSize || 10));
  const sortKey = f.sort || "newest";

  const { complaints } = await collections();
  const total = await complaints.countDocuments(match);

  const sortStages =
    sortKey === "priority"
      ? [...PRIORITY_SORT_STAGES, { $sort: { priority_rank: 1 as const, created_at: -1 as const } }]
      : [{ $sort: SORTS[sortKey] || SORTS.newest }];

  const pipeline: Record<string, unknown>[] = [
    { $match: match },
    ...sortStages,
    { $skip: (page - 1) * pageSize },
    { $limit: pageSize },
    ...lookupStages(),
  ];

  const items = (await complaints.aggregate(pipeline).toArray()).map(withSlaState);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Fetch one complaint with joined display names; returns null when not found. */
export async function getComplaintRow(id: string): Promise<ComplaintRow | null> {
  const { complaints } = await collections();
  const rows = await complaints.aggregate([{ $match: { id } }, ...lookupStages()]).toArray();
  if (rows.length === 0) return null;
  return withSlaState(rows[0] as Record<string, any>);
}

/** Can this user view the given complaint? */
export function canViewComplaint(user: SessionUser, c: ComplaintRow): boolean {
  switch (user.role) {
    case "ADMIN":
      return true;
    case "MANAGER":
      return c.department_id === user.departmentId;
    case "AGENT":
      return c.assigned_agent_id === user.id || c.department_id === user.departmentId;
    default:
      return c.user_id === user.id;
  }
}

