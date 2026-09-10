import { NextResponse } from "next/server";
import { z } from "zod";
import { collections, ensureMongoDb, nextSeq } from "@/lib/mongodb";
import { getSession, err, audit, addEvent, notify } from "@/lib/api-helpers";
import { listComplaints, type ListFilters } from "@/lib/complaint-queries";
import { classifyComplaint, similarity, type AiPrediction } from "@/lib/ai-engine";
import { getSlaHours } from "@/lib/sla";

export const dynamic = "force-dynamic";

const CONFIDENCE_THRESHOLD = Number(process.env.AI_CONFIDENCE_THRESHOLD || 70);

const CreateSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(4000),
  categoryId: z.string().uuid().optional().nullable(),
  subcategory: z.string().max(120).optional().nullable(),
  location: z.string().max(160).optional().nullable(),
  contactMethod: z.string().max(40).optional().nullable(),
  additionalInfo: z.string().max(2000).optional().nullable(),
  confirmDuplicate: z.boolean().optional(),
});

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return err("Authentication required. Please sign in.", 401);
  try {
    await ensureMongoDb();
    const sp = new URL(request.url).searchParams;
    const filters: ListFilters = {
      q: sp.get("q"),
      category: sp.get("category"),
      priority: sp.get("priority"),
      status: sp.get("status"),
      department: sp.get("department"),
      sentiment: sp.get("sentiment"),
      agent: sp.get("agent"),
      slaState: sp.get("slaState"),
      dateFrom: sp.get("dateFrom"),
      dateTo: sp.get("dateTo"),
      sort: sp.get("sort"),
      page: Number(sp.get("page") || 1),
      pageSize: Number(sp.get("pageSize") || 10),
    };
    const result = await listComplaints(user, filters);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("[complaints:GET]", e);
    return err("Unable to load complaints. Please try again.", 500);
  }
}

async function resolveTaxonomyIds(pred: AiPrediction): Promise<{ categoryId: string | null; departmentId: string | null }> {
  const { categories, departments } = await collections();
  const cats = await categories.find({}, { projection: { id: 1, name: 1 } }).toArray();
  const cat =
    cats.find((r: any) => String(r.name).toLowerCase() === pred.categoryName.toLowerCase()) ||
    cats.find((r: any) => String(r.name).toLowerCase().includes(pred.categoryName.toLowerCase().split(" ")[0])) ||
    null;
  const depts = await departments.find({}, { projection: { id: 1, name: 1 } }).toArray();
  const deptName = pred.department.toLowerCase();
  const dept =
    depts.find((r: any) => String(r.name).toLowerCase() === deptName) ||
    depts.find((r: any) => deptName.includes(String(r.name).toLowerCase().split(" ")[0])) ||
    null;
  return { categoryId: (cat as any)?.id || null, departmentId: (dept as any)?.id || null };
}

/** Find already-submitted complaints that look like this one (duplicate detection). */
async function findSimilar(title: string) {
  const { complaints, categories } = await collections();
  const recent = await complaints
    .find({}, { projection: { id: 1, ticket_no: 1, title: 1, status: 1, priority: 1, category_id: 1 } })
    .sort({ created_at: -1 })
    .limit(150)
    .toArray();
  const cats = await categories.find({}, { projection: { id: 1, name: 1 } }).toArray();
  const catName = (id: any) => cats.find((c: any) => c.id === id)?.name || null;
  return recent
    .map((r: any) => ({
      id: r.id, ticket_no: r.ticket_no, title: r.title, status: r.status,
      priority: r.priority, category_name: catName(r.category_id),
      similarity: similarity(`${title}`, `${r.title}`),
    }))
    .filter((r) => r.similarity >= 40)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 4);
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return err("Authentication required. Please sign in.", 401);
  try {
    await ensureMongoDb();
    const body = await request.json().catch(() => null);
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return err("Please provide a complaint title (at least 5 characters) and a description (at least 10 characters).", 400);
    }
    const input = parsed.data;

    // Duplicate detection — warn, never block.
    const similar = await findSimilar(input.title);
    if (similar.length > 0 && !input.confirmDuplicate) {
      return NextResponse.json({
        success: false,
        duplicateWarning: true,
        error: "We found similar complaints. Would you like to review them before submitting?",
        similar,
      }, { status: 409 });
    }

    // ---- AI classification (core feature) ----
    const pred = await classifyComplaint(input.title, input.description);
    const ids = await resolveTaxonomyIds(pred);
    const needsReview = pred.confidence * 100 < CONFIDENCE_THRESHOLD;
    const slaHours = await getSlaHours(pred.priority);
    const slaDeadline = new Date(Date.now() + slaHours * 3600000);
    const id = crypto.randomUUID();
    const now = new Date();
    const seq = await nextSeq("complaints_seq");
    const ticketNo = "RA-" + (1000 + seq);

    const doc = {
      _id: id, id, ticket_no: ticketNo, seq,
      title: input.title, description: input.description,
      category_id: ids.categoryId, subcategory: input.subcategory || pred.subcategory,
      location: input.location || null, contact_method: input.contactMethod || null,
      priority: pred.priority, severity: pred.severity, sentiment: pred.sentiment,
      department_id: ids.departmentId, assigned_agent_id: null, user_id: user.id,
      status: "AI_ANALYZED",
      ai_category_id: ids.categoryId, ai_subcategory: input.subcategory || pred.subcategory,
      ai_priority: pred.priority, ai_severity: pred.severity, ai_sentiment: pred.sentiment,
      ai_department_id: ids.departmentId, ai_confidence: pred.confidence,
      ai_suggested_resolution: pred.suggestedResolution,
      classification_source: "AI_GENERATED",
      needs_human_review: needsReview,
      review_status: needsReview ? "AWAITING" : "NOT_REQUIRED",
      reviewed_by: null, reviewed_at: null,
      sla_deadline: slaDeadline, resolved_at: null, closed_at: null,
      additional_info: input.additionalInfo || null,
      ai_analyzed_at: now, created_at: now, updated_at: now,
    };
    const { complaints, complaint_classifications, users } = await collections();
    await complaints.insertOne(doc);

    await complaint_classifications.insertOne({
      _id: crypto.randomUUID(), id: crypto.randomUUID(), complaint_id: id,
      category: pred.categoryName, subcategory: pred.subcategory, priority: pred.priority,
      severity: pred.severity, sentiment: pred.sentiment, department: pred.department,
      confidence: pred.confidence, suggested_resolution: pred.suggestedResolution,
      model_version: pred.model, is_human_reviewed: false, reviewed_by: null,
      created_at: now,
    });

    await addEvent(id, "CREATED", "Complaint submitted", `Ticket ${ticketNo} created by ${user.name || user.email}`, user.id);
    await addEvent(id, "AI_CLASSIFIED", "AI classified complaint",
      `${pred.categoryName} · ${pred.priority} priority · ${pred.department} · confidence ${Math.round(pred.confidence * 100)}% (${pred.model})`,
      null, null, pred.categoryName);
    await audit(user, "COMPLAINT_CREATED", "complaint", id, ticketNo, `AI classified as ${pred.categoryName} / ${pred.priority}`);

    // Notify department staff + admins about the new complaint.
    if (ids.departmentId) {
      const staff = await users
        .find({ department_id: ids.departmentId, role: { $in: ["AGENT", "MANAGER"] } }, { projection: { id: 1 } })
        .toArray();
      for (const s of staff) {
        await notify(String((s as any).id), needsReview ? "HUMAN_REVIEW" : "NEW_COMPLAINT",
          needsReview ? "Human review required" : "New complaint routed to your department",
          `${ticketNo}: ${input.title} (AI: ${pred.categoryName}, ${pred.priority})`, id);
      }
    }

    const row = await complaints.findOne({ id });
    return NextResponse.json({
      success: true,
      complaint: row,
      ticketNo,
      prediction: pred,
      confidenceThreshold: CONFIDENCE_THRESHOLD,
      needsHumanReview: needsReview,
      similar,
    }, { status: 201 });
  } catch (e) {
    console.error("[complaints:POST]", e);
    return err("Complaint could not be submitted. Please try again.", 500);
  }
}

