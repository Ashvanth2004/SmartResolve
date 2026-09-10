import { NextResponse } from "next/server";
import { collections, ensureMongoDb } from "@/lib/mongodb";
import { getSession, err, audit, addEvent, notify } from "@/lib/api-helpers";
import { getComplaintRow, canViewComplaint } from "@/lib/complaint-queries";

export const dynamic = "force-dynamic";

const MAX_MSG = 4000;

/** POST /api/complaints/:id/messages — customer reply, agent reply or internal note. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return err("Authentication required. Please sign in.", 401);
  try {
    await ensureMongoDb();
    const { id } = await ctx.params;
    const c = await getComplaintRow(id);
    if (!c) return err("Complaint not found.", 404);
    if (!canViewComplaint(user, c)) return err("You don't have permission to post on this complaint.", 403);

    const body = await request.json().catch(() => null);
    const content = String(body?.content || "").trim();
    if (content.length < 1) return err("Message cannot be empty.", 400);
    if (content.length > MAX_MSG) return err(`Message exceeds the maximum length of ${MAX_MSG} characters.`, 400);
    const isStaff = user.role !== "USER";
    const isInternal = Boolean(body?.isInternal) && isStaff; // customers can never post internal notes
    const attName = body?.attachmentName ? String(body.attachmentName).slice(0, 200) : null;

    const { complaint_messages, users } = await collections();
    const mid = crypto.randomUUID();
    await complaint_messages.insertOne({
      _id: mid, id: mid, complaint_id: id, author_id: user.id, content,
      is_internal: isInternal,
      attachment_name: attName,
      attachment_type: body?.attachmentType ? String(body.attachmentType).slice(0, 100) : null,
      attachment_size: Number(body?.attachmentSize) || null,
      created_at: new Date(),
    });

    await addEvent(id, isInternal ? "INTERNAL_NOTE" : "MESSAGE",
      isInternal ? "Internal note added" : (isStaff ? "Agent replied" : "Customer replied"),
      content.slice(0, 140), user.id);

    // Notify the other side of the conversation.
    if (isStaff) {
      await notify(c.user_id, "AGENT_REPLY", "Support replied to your complaint", `${c.ticket_no}: ${content.slice(0, 100)}`, id);
      if (c.assigned_agent_id && c.assigned_agent_id !== user.id) {
        await notify(c.assigned_agent_id, "STATUS_CHANGED", "Complaint updated", `New reply on ${c.ticket_no}`, id);
      }
    } else {
      const targets: string[] = [];
      if (c.assigned_agent_id) targets.push(c.assigned_agent_id);
      else if (c.department_id) {
        const staff = await users
          .find({ department_id: c.department_id, role: { $in: ["AGENT", "MANAGER"] } }, { projection: { id: 1 } })
          .toArray();
        for (const s of staff) targets.push(String((s as any).id));
      }
      for (const t of targets) {
        await notify(t, "CUSTOMER_REPLY", "Customer replied", `${c.ticket_no}: ${content.slice(0, 100)}`, id);
      }
    }
    await audit(user, isInternal ? "INTERNAL_NOTE" : "COMMENT_ADDED", "complaint", id, c.ticket_no, content.slice(0, 120));
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) {
    console.error("[messages:POST]", e);
    return err("Message could not be sent. Please try again.", 500);
  }
}
