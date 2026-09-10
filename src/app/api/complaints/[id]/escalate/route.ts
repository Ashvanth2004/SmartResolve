import { NextResponse } from "next/server";
import { collections, ensureMongoDb } from "@/lib/mongodb";
import { getSession, err, audit, addEvent, notify } from "@/lib/api-helpers";
import { getComplaintRow, canViewComplaint } from "@/lib/complaint-queries";

export const dynamic = "force-dynamic";

/** POST /api/complaints/:id/escalate — manual escalation. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return err("Authentication required. Please sign in.", 401);
  if (user.role === "USER") return err("You don't have permission to perform this action.", 403);
  try {
    await ensureMongoDb();
    const { id } = await ctx.params;
    const c = await getComplaintRow(id);
    if (!c) return err("Complaint not found.", 404);
    if (!canViewComplaint(user, c)) return err("You don't have permission to modify this complaint.", 403);
    if (c.status === "ESCALATED") return err("This complaint is already escalated.", 400);

    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason || "SLA breached").slice(0, 200);

    const { complaints, escalations, users } = await collections();
    await complaints.updateOne({ id }, { $set: { status: "ESCALATED", updated_at: new Date() } });
    const eid = crypto.randomUUID();
    await escalations.insertOne({
      _id: eid, id: eid, complaint_id: id, triggered_by: user.id,
      reason, details: body.details ? String(body.details).slice(0, 500) : null,
      status: "OPEN", resolved_at: null, created_at: new Date(),
    });
    await addEvent(id, "ESCALATED", "Complaint escalated", reason, user.id, c.status, "ESCALATED");
    await audit(user, "COMPLAINT_ESCALATED", "complaint", id, c.ticket_no, reason);

    // Notify department managers + admins.
    const managers = await users
      .find({ $or: [{ role: "ADMIN" }, { role: "MANAGER", department_id: c.department_id }] }, { projection: { id: 1 } })
      .toArray();
    for (const m of managers) {
      await notify(String((m as any).id), "COMPLAINT_ESCALATED", "Complaint escalated", `${c.ticket_no}: ${c.title} — ${reason}`, id);
    }
    if (c.assigned_agent_id && c.assigned_agent_id !== user.id) {
      await notify(c.assigned_agent_id, "COMPLAINT_ESCALATED", "Complaint escalated", `${c.ticket_no} was escalated: ${reason}`, id);
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[escalate]", e);
    return err("Unable to escalate this complaint. Please try again.", 500);
  }
}
