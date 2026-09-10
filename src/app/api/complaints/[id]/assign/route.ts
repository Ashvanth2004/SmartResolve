import { NextResponse } from "next/server";
import { collections, ensureMongoDb } from "@/lib/mongodb";
import { getSession, err, audit, addEvent, notify } from "@/lib/api-helpers";
import { getComplaintRow, canViewComplaint } from "@/lib/complaint-queries";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

/** POST /api/complaints/:id/assign — assign to an agent, or accept (assign to self). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return err("Authentication required. Please sign in.", 401);
  if (user.role === "USER") return err("You don't have permission to perform this action.", 403);
  try {
    await ensureMongoDb();
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return err("Complaint not found.", 404);
    const c = await getComplaintRow(id);
    if (!c) return err("Complaint not found.", 404);
    if (!canViewComplaint(user, c)) return err("You don't have permission to modify this complaint.", 403);

    const body = await request.json().catch(() => ({}));
    let agentId = String(body.agentId || "");
    if (!agentId) agentId = user.id; // accept: assign to self
    if (!UUID_RE.test(agentId)) return err("Please select a valid agent.", 400);

    if (user.role === "AGENT" && agentId !== user.id) {
      return err("Agents can only accept complaints into their own queue.", 403);
    }
    const { users, complaints } = await collections();
    const agent = await users.findOne({ id: agentId }, { projection: { id: 1, name: 1, role: 1, department_id: 1 } });
    if (!agent) return err("Agent not found.", 404);
    const a = agent as any;
    if (!["AGENT", "MANAGER", "ADMIN"].includes(a.role)) return err("Selected user is not a support agent.", 400);

    const newStatus =
      ["NEW", "AI_ANALYZED", "REOPENED"].includes(c.status) ? "ASSIGNED"
      : c.status === "ESCALATED" ? "IN_PROGRESS"
      : c.status;
    await complaints.updateOne(
      { id },
      { $set: { assigned_agent_id: agentId, status: newStatus, updated_at: new Date() } }
    );
    await addEvent(id, "ASSIGNED", `Assigned to ${a.name}`, user.id === agentId ? "Agent accepted the complaint" : `Assigned by ${user.name}`, user.id, c.agent_name, a.name);
    await audit(user, "COMPLAINT_ASSIGNED", "complaint", id, c.ticket_no, `${c.agent_name || "Unassigned"} → ${a.name}`);
    await notify(agentId, "COMPLAINT_ASSIGNED", user.id === agentId ? "Complaint accepted" : "Complaint assigned to you", `${c.ticket_no}: ${c.title}`, id);
    return NextResponse.json({ success: true, agent: { id: a.id, name: a.name } });
  } catch (e) {
    console.error("[assign]", e);
    return err("Unable to assign this complaint. Please try again.", 500);
  }
}
