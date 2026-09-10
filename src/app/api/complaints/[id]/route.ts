import { NextResponse } from "next/server";
import { collections, ensureMongoDb } from "@/lib/mongodb";
import { getSession, err, audit, addEvent, notify } from "@/lib/api-helpers";
import { getComplaintRow, canViewComplaint, type ComplaintRow } from "@/lib/complaint-queries";
import { getSlaHours } from "@/lib/sla";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

export async function GET(_request: Request, ctx: Ctx) {
  const user = await getSession();
  if (!user) return err("Authentication required. Please sign in.", 401);
  try {
    await ensureMongoDb();
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return err("Complaint not found.", 404);
    const c = await getComplaintRow(id);
    if (!c) return err("Complaint not found.", 404);
    if (!canViewComplaint(user, c)) return err("You don't have permission to view this complaint.", 403);

    const isStaff = user.role !== "USER";
    const {
      users, complaint_messages, complaint_events, complaint_attachments,
      complaint_classifications, feedback, ai_feedback,
    } = await collections();

    const authorLookup = { from: "users", localField: "author_id", foreignField: "id", as: "_a" };
    const messages = await complaint_messages.aggregate([
      { $match: { complaint_id: id, ...(isStaff ? {} : { is_internal: false }) } },
      { $sort: { created_at: 1 as const } },
      { $lookup: { ...authorLookup } },
      { $addFields: { author_name: { $arrayElemAt: ["$_a.name", 0] }, author_role: { $arrayElemAt: ["$_a.role", 0] } } },
      { $unset: "_a" },
    ]).toArray();

    const actorLookup = { from: "users", localField: "actor_id", foreignField: "id", as: "_a" };
    const events = await complaint_events.aggregate([
      { $match: { complaint_id: id } },
      { $sort: { created_at: 1 as const } },
      { $lookup: { ...actorLookup } },
      { $addFields: { actor_name: { $arrayElemAt: ["$_a.name", 0] } } },
      { $unset: "_a" },
    ]).toArray();

    const attachments = await complaint_attachments.aggregate([
      { $match: { complaint_id: id } },
      { $sort: { created_at: 1 as const } },
      { $lookup: { from: "users", localField: "uploader_id", foreignField: "id", as: "_a" } },
      { $addFields: { uploader_name: { $arrayElemAt: ["$_a.name", 0] } } },
      { $unset: "_a" },
    ]).toArray();

    const classifications = await complaint_classifications.aggregate([
      { $match: { complaint_id: id } },
      { $sort: { created_at: -1 as const } },
      { $lookup: { from: "users", localField: "reviewed_by", foreignField: "id", as: "_a" } },
      { $addFields: { reviewer_name: { $arrayElemAt: ["$_a.name", 0] } } },
      { $unset: "_a" },
    ]).toArray();

    const fb = await feedback.aggregate([
      { $match: { complaint_id: id } },
      { $sort: { created_at: -1 as const } },
      { $limit: 1 },
      { $lookup: { from: "users", localField: "user_id", foreignField: "id", as: "_a" } },
      { $addFields: { user_name: { $arrayElemAt: ["$_a.name", 0] } } },
      { $unset: "_a" },
    ]).toArray();

    const aiFb = isStaff
      ? await ai_feedback.find({ complaint_id: id }).sort({ created_at: -1 }).limit(1).toArray()
      : [];

    return NextResponse.json({
      success: true,
      complaint: c,
      messages,
      events,
      attachments,
      classifications,
      feedback: fb[0] || null,
      aiFeedback: aiFb[0] || null,
      viewer: { id: user.id, role: user.role },
    });
  } catch (e) {
    console.error("[complaint:GET]", e);
    return err("Unable to load this complaint. Please try again.", 500);
  }
}

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

export async function PATCH(request: Request, ctx: Ctx) {
  const user = await getSession();
  if (!user) return err("Authentication required. Please sign in.", 401);
  try {
    await ensureMongoDb();
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return err("Complaint not found.", 404);
    const c = await getComplaintRow(id);
    if (!c) return err("Complaint not found.", 404);
    if (!canViewComplaint(user, c)) return err("You don't have permission to modify this complaint.", 403);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid request body.", 400);
    const action = String(body.action || "status");
    const isStaff = user.role !== "USER";

    // ---- Customer reopens a resolved/closed complaint ----
    if (action === "status" && body.status === "REOPENED") {
      if (!["RESOLVED", "CLOSED"].includes(c.status)) return err("Only resolved complaints can be reopened.", 400);
      if (!isStaff && c.user_id !== user.id) return err("You don't have permission to perform this action.", 403);
      const { complaints } = await collections();
      await complaints.updateOne({ id }, { $set: { status: "REOPENED", resolved_at: null, closed_at: null, updated_at: new Date() } });
      await addEvent(id, "STATUS", "Complaint reopened", `Reopened by ${user.name || user.email}`, user.id, c.status, "REOPENED");
      await audit(user, "STATUS_CHANGE", "complaint", id, c.ticket_no, `${c.status} → REOPENED`);
      if (c.assigned_agent_id) {
        await notify(c.assigned_agent_id, "STATUS_CHANGED", "Complaint reopened", `${c.ticket_no} was reopened by the customer.`, id);
      }
      return NextResponse.json({ success: true });
    }

    if (!isStaff) return err("You don't have permission to perform this action.", 403);

    // ---- Status change (agent/manager/admin) ----
    if (action === "status") {
      const next = String(body.status || "");
      const allowed = TRANSITIONS[c.status] || [];
      if (!allowed.includes(next)) return err(`Cannot change status from ${c.status} to ${next || "(none)"}.`, 400);
      const resolvedAt = next === "RESOLVED" ? new Date() : null;
      const closedAt = next === "CLOSED" ? new Date() : null;
      const { complaints } = await collections();
      const set: Record<string, unknown> = { status: next, updated_at: new Date() };
      if (resolvedAt) set.resolved_at = resolvedAt;
      if (closedAt) set.closed_at = closedAt;
      await complaints.updateOne({ id }, { $set: set });
      await addEvent(id, "STATUS", `Status changed to ${next.replace("_", " ")}`, String(body.reason || ""), user.id, c.status, next);
      await audit(user, "STATUS_CHANGE", "complaint", id, c.ticket_no, `${c.status} → ${next}`);
      await notify(c.user_id, "STATUS_CHANGED", "Complaint status updated", `${c.ticket_no} is now ${next.replace("_", " ")}.`, id);
      if (next === "RESOLVED") {
        await notify(c.user_id, "RESOLVED", "Complaint resolved", `${c.ticket_no} has been marked as resolved. Please rate your experience.`, id);
      }
      if (c.assigned_agent_id && c.assigned_agent_id !== user.id) {
        await notify(c.assigned_agent_id, "STATUS_CHANGED", "Complaint status updated", `${c.ticket_no} is now ${next.replace("_", " ")}.`, id);
      }
      return NextResponse.json({ success: true });
    }

    // ---- Priority override (manager/admin) ----
    if (action === "priority") {
      if (user.role === "AGENT") return err("You don't have permission to perform this action.", 403);
      const priority = String(body.priority || "");
      if (!["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(priority)) return err("Invalid priority value.", 400);
      const slaHours = await getSlaHours(priority);
      const stillOpen = !["RESOLVED", "CLOSED"].includes(c.status);
      const slaDeadline = stillOpen ? new Date(Date.now() + slaHours * 3600000) : c.sla_deadline;
      const { complaints } = await collections();
      await complaints.updateOne({ id }, { $set: { priority, sla_deadline: slaDeadline, updated_at: new Date() } });
      await addEvent(id, "PRIORITY", `Priority changed to ${priority}`, `SLA recomputed to ${slaHours}h`, user.id, c.priority, priority);
      await audit(user, "PRIORITY_CHANGE", "complaint", id, c.ticket_no, `${c.priority} → ${priority}`);
      await notify(c.user_id, "STATUS_CHANGED", "Complaint priority updated", `${c.ticket_no} priority is now ${priority}.`, id);
      return NextResponse.json({ success: true });
    }

    // ---- Department re-route (manager/admin) ----
    if (action === "department") {
      if (user.role === "AGENT") return err("You don't have permission to perform this action.", 403);
      const departmentId = String(body.departmentId || "");
      if (!UUID_RE.test(departmentId)) return err("Invalid department.", 400);
      const { complaints, departments, users } = await collections();
      const dept = await departments.findOne({ id: departmentId }, { projection: { name: 1 } });
      if (!dept) return err("Department not found.", 404);
      const deptName = (dept as any).name;
      await complaints.updateOne({ id }, { $set: { department_id: departmentId, assigned_agent_id: null, updated_at: new Date() } });
      await addEvent(id, "DEPARTMENT", `Routed to ${deptName}`, "AI assignment overridden by staff", user.id, c.department_name, deptName);
      await audit(user, "DEPARTMENT_CHANGE", "complaint", id, c.ticket_no, `${c.department_name || "—"} → ${deptName}`);
      const staff = await users
        .find({ department_id: departmentId, role: { $in: ["AGENT", "MANAGER"] } }, { projection: { id: 1 } })
        .toArray();
      for (const s of staff) {
        await notify(String((s as any).id), "COMPLAINT_REASSIGNED", "Complaint routed to your department", `${c.ticket_no}: ${c.title}`, id);
      }
      return NextResponse.json({ success: true });
    }

    return err("Unknown action.", 400);
  } catch (e) {
    console.error("[complaint:PATCH]", e);
    return err("Unable to update this complaint. Please try again.", 500);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const user = await getSession();
  if (!user) return err("Authentication required. Please sign in.", 401);
  if (user.role !== "ADMIN") return err("You don't have permission to perform this action.", 403);
  try {
    await ensureMongoDb();
    const { id } = await ctx.params;
    const c = await getComplaintRow(id);
    if (!c) return err("Complaint not found.", 404);
    const { complaints, complaint_messages, complaint_events, complaint_attachments, complaint_classifications, feedback, ai_feedback, escalations } = await collections();
    await complaints.deleteOne({ id });
    await complaint_messages.deleteMany({ complaint_id: id });
    await complaint_events.deleteMany({ complaint_id: id });
    await complaint_attachments.deleteMany({ complaint_id: id });
    await complaint_classifications.deleteMany({ complaint_id: id });
    await feedback.deleteMany({ complaint_id: id });
    await ai_feedback.deleteMany({ complaint_id: id });
    await escalations.deleteMany({ complaint_id: id });
    await audit(user, "COMPLAINT_DELETED", "complaint", id, c.ticket_no, `Deleted complaint "${c.title}"`);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[complaint:DELETE]", e);
    return err("Unable to delete this complaint.", 500);
  }
}

