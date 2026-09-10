import type { Collections } from "@/lib/mongodb";
import {
  COMPLAINTS, mulberry32, UUID, DEPT_IDS, CAT_IDS, USER_IDS, DEPT_NAME,
} from "@/lib/seed-data";
import { demoHash } from "@/lib/password";

const DEMO = demoHash();

/** Idempotent demo seed: only runs when the database is empty. */
export async function seedDemoData(c: Collections): Promise<void> {
  const rnd = mulberry32(20260214);
  const now = new Date();

  // ---- Departments / Categories / Users / SLA rules -----------------------------
  await c.departments.insertMany(
    [
      { id: DEPT_IDS.cs, name: "Customer Support", description: "Handles account, service quality, staff behaviour and general enquiries" },
      { id: DEPT_IDS.ts, name: "Technical Support", description: "Handles software, hardware, network, infrastructure and app issues" },
      { id: DEPT_IDS.billing, name: "Billing & Finance", description: "Handles billing, payment, refunds, and invoices" },
      { id: DEPT_IDS.ops, name: "Operations", description: "Handles delivery, logistics, product fulfilment and facilities" },
      { id: DEPT_IDS.sec, name: "Security", description: "Handles account security, fraud, unauthorised access and privacy" },
    ].map((d) => ({ ...d, _id: d.id, created_at: now }))
  );

  await c.categories.insertMany(
    [
      { id: CAT_IDS.tech, name: "Technical Support", description: "Software, hardware, connectivity, devices and infrastructure issues", color: "#6366f1" },
      { id: CAT_IDS.billing, name: "Billing", description: "Invoices, billing errors, duplicate charges, and charge disputes", color: "#f59e0b" },
      { id: CAT_IDS.payment, name: "Payment", description: "Payment failures, declined transactions, refunds", color: "#8b5cf6" },
      { id: CAT_IDS.account, name: "Account", description: "Login, password, profile, verification, and account access issues", color: "#06b6d4" },
      { id: CAT_IDS.delivery, name: "Delivery", description: "Late, lost, damaged shipments, and tracking problems", color: "#10b981" },
      { id: CAT_IDS.product, name: "Product", description: "Defective, damaged, malfunctioning products, and quality complaints", color: "#f43f5e" },
      { id: CAT_IDS.service, name: "Service Quality", description: "Slow service, rude staff, poor experience", color: "#ec4899" },
      { id: CAT_IDS.security, name: "Security", description: "Unauthorised access, suspicious activity, privacy, and fraud concerns", color: "#ef4444" },
      { id: CAT_IDS.infra, name: "Infrastructure", description: "Power, network infrastructure, and building facilities", color: "#14b8a6" },
      { id: CAT_IDS.staff, name: "Staff Behavior", description: "Complaints about staff conduct, communication, professionalism", color: "#f97316" },
      { id: CAT_IDS.other, name: "Other", description: "Anything that does not fit another category", color: "#94a3b8" },
    ].map((d) => ({ ...d, _id: d.id, created_at: now }))
  );

  const userRows: Array<{ id: string; name: string; email: string; role: string; department_id: string | null }> = [
    { id: USER_IDS.admin, name: "Aarav Mehta", email: "admin@resolveai.io", role: "ADMIN", department_id: null },
    { id: USER_IDS.manager, name: "Priya Sharma", email: "manager@resolveai.io", role: "MANAGER", department_id: DEPT_IDS.billing },
    { id: USER_IDS.agentTech, name: "Rahul Verma", email: "agent@resolveai.io", role: "AGENT", department_id: DEPT_IDS.ts },
    { id: USER_IDS.agentBilling, name: "Fatima Khan", email: "billing.agent@resolveai.io", role: "AGENT", department_id: DEPT_IDS.billing },
    { id: USER_IDS.agentCs, name: "Arjun Nair", email: "cs.agent@resolveai.io", role: "AGENT", department_id: DEPT_IDS.cs },
    { id: USER_IDS.agentOps, name: "Meera Pillai", email: "ops.agent@resolveai.io", role: "AGENT", department_id: DEPT_IDS.ops },
    { id: USER_IDS.agentSec, name: "Vikram Rathore", email: "security.agent@resolveai.io", role: "AGENT", department_id: DEPT_IDS.sec },
    { id: USER_IDS.c1, name: "Sneha Iyer", email: "customer@resolveai.io", role: "USER", department_id: null },
    { id: USER_IDS.c2, name: "Rohan Gupta", email: "customer2@resolveai.io", role: "USER", department_id: null },
    { id: USER_IDS.c3, name: "Ananya Das", email: "customer3@resolveai.io", role: "USER", department_id: null },
    { id: USER_IDS.c4, name: "Karthik Rao", email: "customer4@resolveai.io", role: "USER", department_id: null },
    { id: USER_IDS.c5, name: "Zoya Sheikh", email: "customer5@resolveai.io", role: "USER", department_id: null },
    { id: USER_IDS.c6, name: "Dev Patel", email: "customer6@resolveai.io", role: "USER", department_id: null },
    { id: USER_IDS.c7, name: "Ishita Bose", email: "customer7@resolveai.io", role: "USER", department_id: null },
    { id: USER_IDS.c8, name: "Farhan Ali", email: "customer8@resolveai.io", role: "USER", department_id: null },
    { id: USER_IDS.c9, name: "Lakshmi Menon", email: "customer9@resolveai.io", role: "USER", department_id: null },
    { id: USER_IDS.c10, name: "Nikhil Joshi", email: "customer10@resolveai.io", role: "USER", department_id: null },
  ];
  await c.users.insertMany(
    userRows.map((u) => ({
      ...u, _id: u.id, password_hash: DEMO.hash, salt: DEMO.salt,
      created_at: now, updated_at: now,
    }))
  );

  await c.sla_rules.insertMany([
    { _id: UUID(60), id: UUID(60), priority: "CRITICAL", time_limit_hours: 4, is_active: true, created_at: now, updated_at: now },
    { _id: UUID(61), id: UUID(61), priority: "HIGH", time_limit_hours: 12, is_active: true, created_at: now, updated_at: now },
    { _id: UUID(62), id: UUID(62), priority: "MEDIUM", time_limit_hours: 24, is_active: true, created_at: now, updated_at: now },
    { _id: UUID(63), id: UUID(63), priority: "LOW", time_limit_hours: 72, is_active: true, created_at: now, updated_at: now },
  ]);

  // ---- Complaints + classifications + events + messages ------------------------
  const AGENTS = [USER_IDS.agentTech, USER_IDS.agentBilling, USER_IDS.agentCs, USER_IDS.agentOps, USER_IDS.agentSec];
  const CUSTOMERS = [USER_IDS.c1, USER_IDS.c2, USER_IDS.c3, USER_IDS.c4, USER_IDS.c5,
                     USER_IDS.c6, USER_IDS.c7, USER_IDS.c8, USER_IDS.c9, USER_IDS.c10];
  const REVIEWERS = [USER_IDS.manager, USER_IDS.agentTech, USER_IDS.agentBilling, USER_IDS.agentCs, USER_IDS.admin];
  const SLA_HOURS: Record<string, number> = { CRITICAL: 4, HIGH: 12, MEDIUM: 24, LOW: 72 };

  const complaintDocs: any[] = [];
  const classificationDocs: any[] = [];
  const eventDocs: any[] = [];
  const messageDocs: any[] = [];
  const feedbackDocs: any[] = [];
  const aiFeedbackDocs: any[] = [];
  const auditDocs: any[] = [];
  const notificationDocs: any[] = [];

  for (let i = 0; i < COMPLAINTS.length; i++) {
    const [title, description, catKey, subcat, prio, sev, sent, deptKey, status, needsReview, src, resolution] = COMPLAINTS[i];
    const catId = CAT_IDS[catKey];
    const deptId = DEPT_IDS[deptKey];
    const corrected = src === "HUMAN_CORRECTED";
    const needsReviewB = needsReview === "true";
    const daysAgo = 1 + Math.floor(rnd() * 25);
    const hoursAgo = Math.floor(rnd() * 16);
    const createdAt = new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000);
    const slaH = SLA_HOURS[prio] || 24;
    const slaDeadline = new Date(createdAt.getTime() + slaH * 3600000);

    let statusEff = status;
    const r = rnd();
    if ((status === "ASSIGNED" || status === "IN_PROGRESS") && r > 0.85) statusEff = "ESCALATED";
    if (status === "IN_PROGRESS" && r > 0.6 && r < 0.68) statusEff = "WAITING";

    const resolved = ["RESOLVED", "CLOSED"].includes(statusEff);
    const closedLate = rnd() > 0.7;
    const resolvedAt = resolved
      ? new Date(slaDeadline.getTime() + (closedLate ? 1 : -1) * (1 + Math.floor(rnd() * 10)) * 3600000)
      : null;
    const assignee = ["ASSIGNED", "IN_PROGRESS", "WAITING", "ESCALATED"].includes(statusEff)
      ? AGENTS[Math.floor(rnd() * AGENTS.length)]
      : null;
    const customerId = CUSTOMERS[i % CUSTOMERS.length];
    const confidence = needsReviewB ? 42 + Math.floor(rnd() * 26) : 80 + Math.floor(rnd() * 20);

    const cid = UUID(100 + i);
    const ticketNo = "RA-" + (1001 + i);

    complaintDocs.push({
      _id: cid, id: cid, ticket_no: ticketNo, seq: i + 1,
      title, description, category_id: catId, subcategory: subcat, location: null, contact_method: null,
      priority: prio, severity: sev, sentiment: sent, department_id: deptId,
      assigned_agent_id: assignee, user_id: customerId, status: statusEff,
      ai_category_id: catId, ai_subcategory: subcat, ai_priority: prio, ai_severity: sev,
      ai_sentiment: sent, ai_department_id: deptId, ai_confidence: Math.round(confidence) / 100,
      ai_suggested_resolution: resolution,
      classification_source: corrected ? "HUMAN_CORRECTED" : "AI_GENERATED",
      needs_human_review: needsReviewB,
      review_status: corrected ? "REVIEWED" : needsReviewB ? "AWAITING" : "NOT_REQUIRED",
      reviewed_by: corrected ? REVIEWERS[i % REVIEWERS.length] : null,
      reviewed_at: corrected ? createdAt : null,
      sla_deadline: slaDeadline, resolved_at: resolvedAt, closed_at: null,
      additional_info: null,
      ai_analyzed_at: new Date(createdAt.getTime() + (1 + Math.floor(rnd() * 5)) * 60000),
      created_at: createdAt, updated_at: createdAt,
    });

    classificationDocs.push({
      _id: UUID(300 + i), id: UUID(300 + i), complaint_id: cid,
      category: catKey, subcategory: subcat, priority: prio, severity: "Medium", sentiment: sent,
      department: DEPT_NAME[deptKey], confidence: confidence / 100,
      suggested_resolution: resolution, model_version: "semantic-taxonomy-v1",
      is_human_reviewed: corrected, reviewed_by: corrected ? USER_IDS.manager : null,
      created_at: createdAt,
    });

    const t0 = createdAt.getTime();
    const at = (mins: number) => new Date(t0 + mins * 60000);
    eventDocs.push({ _id: UUID(400 + i * 8), id: UUID(400 + i * 8), complaint_id: cid, actor_id: customerId, type: "CREATED", title: "Complaint submitted", description: "Complaint created by the customer.", old_value: null, new_value: null, created_at: at(0) });
    eventDocs.push({ _id: UUID(400 + i * 8 + 1), id: UUID(400 + i * 8 + 1), complaint_id: cid, actor_id: null, type: "AI_CLASSIFIED", title: "AI classified complaint", description: "AI analysed the text and recommended a category, priority and department.", old_value: null, new_value: null, created_at: at(1) });
    let mins = 2;
    if (assignee) {
      eventDocs.push({ _id: UUID(400 + i * 8 + 2), id: UUID(400 + i * 8 + 2), complaint_id: cid, actor_id: null, type: "ASSIGNED", title: "Assigned to department", description: "Routed to the recommended department and queued.", old_value: null, new_value: "AI routing", created_at: at(mins) });
      mins += 1;
    }
    const stage = ["ASSIGNED", "IN_PROGRESS", "WAITING", "ESCALATED"].includes(statusEff);
    if (stage) {
      eventDocs.push({ _id: UUID(400 + i * 8 + 3), id: UUID(400 + i * 8 + 3), complaint_id: cid, actor_id: assignee || REVIEWERS[i % REVIEWERS.length], type: "STATUS_CHANGE", title: "Status changed", description: "Agent updated the complaint status.", old_value: null, new_value: statusEff, created_at: at(mins) });
      mins += 40;
    }
    if (resolved) {
      eventDocs.push({ _id: UUID(400 + i * 8 + 4), id: UUID(400 + i * 8 + 4), complaint_id: cid, actor_id: assignee || REVIEWERS[i % REVIEWERS.length], type: "RESOLUTION", title: "Complaint resolved", description: "Issue was resolved by the agent.", old_value: null, new_value: "RESOLVED", created_at: at(mins) });
    }
    if (i % 4 === 0) {
      messageDocs.push({ _id: UUID(500 + i), id: UUID(500 + i), complaint_id: cid, author_id: customerId, content: "Please keep me updated on the progress of this issue. Thank you.", is_internal: false, attachment_name: null, attachment_type: null, attachment_size: null, created_at: at(mins + 20) });
    }
    if (i % 3 !== 0) {
      const rating = 3 + Math.floor(rnd() * 3);
      feedbackDocs.push({
        _id: UUID(600 + i), id: UUID(600 + i), complaint_id: cid, user_id: customerId,
        rating: rating >= 5 ? 5 : rating,
        comment: rating >= 4 ? "Resolved quickly and courteously." : "Issue was fixed but could be faster.",
        created_at: at(mins + 30),
      });
    }
    if (i % 4 === 0) {
      aiFeedbackDocs.push({ _id: UUID(700 + i), id: UUID(700 + i), complaint_id: cid, is_correct: true, original_category: catKey, original_priority: prio, original_department: deptKey, correct_category: catKey, correct_priority: prio, correct_department: deptKey, reviewer_id: REVIEWERS[i % REVIEWERS.length], notes: "AI classification was accurate.", created_at: createdAt });
    }
    if (i % 7 === 3) {
      aiFeedbackDocs.push({ _id: UUID(800 + i), id: UUID(800 + i), complaint_id: cid, is_correct: false, original_category: catKey, original_priority: prio, original_department: deptKey, correct_category: "Billing & Finance", correct_priority: prio, correct_department: deptKey, reviewer_id: REVIEWERS[i % REVIEWERS.length], notes: "Misclassified the department.", created_at: createdAt });
    }
  }

  await c.complaints.insertMany(complaintDocs);
  await c.complaint_classifications.insertMany(classificationDocs);
  await c.complaint_events.insertMany(eventDocs);
  if (messageDocs.length) await c.complaint_messages.insertMany(messageDocs);
  if (feedbackDocs.length) await c.feedback.insertMany(feedbackDocs);
  if (aiFeedbackDocs.length) await c.ai_feedback.insertMany(aiFeedbackDocs);

  // ---- Audit trail + notifications ----------------------------------------------
  const actions = ["LOGIN", "COMPLAINT_VIEW", "STATUS_CHANGE", "CLASSIFICATION", "ASSIGNMENT", "ESCALATION", "MESSAGE", "RESOLUTION"];
  const auditDocs2: any[] = [];
  for (let i = 0; i < 45; i++) {
    const complaint = complaintDocs[i % complaintDocs.length];
    auditDocs2.push({
      _id: UUID(900 + i), id: UUID(900 + i), user_id: REVIEWERS[i % REVIEWERS.length],
      action: actions[i % actions.length], entity_type: "complaint", entity_id: complaint.id,
      entity_label: complaint.title, details: "Demo audit trail entry for a complaint workflow action.",
      created_at: new Date(Date.now() - (i + 1) * 3600000),
    });
  }
  await c.audit_logs.insertMany(auditDocs2);

  const notifDefs = [
    ["SLA_APPROACHING", "SLA deadline approaching", "Please review the open complaints with expiring SLAs."],
    ["COMPLAINT_ASSIGNED", "New complaint assigned", "A new complaint has been assigned to your queue."],
    ["COMPLAINT_ESCALATED", "Complaint escalated", "A high priority complaint was escalated for review."],
    ["SLA_BREACHED", "SLA breached", "A complaint has exceeded its SLA deadline."],
  ];
  for (let i = 0; i < 8; i++) {
    const nd = notifDefs[i % notifDefs.length];
    notificationDocs.push({
      _id: UUID(950 + i), id: UUID(950 + i), user_id: AGENTS[i % AGENTS.length],
      type: nd[0], title: nd[1], message: nd[2], complaint_id: UUID(100 + i),
      read: i % 2 === 0, created_at: new Date(Date.now() - (i + 1) * 7200000),
    });
  }
  notificationDocs.push(
    { _id: UUID(960), id: UUID(960), user_id: USER_IDS.agentTech, type: "WELCOME", title: "Welcome to ResolveAI", message: "Your demo agent account is ready. Explore assigned complaints.", complaint_id: null, read: false, created_at: now },
    { _id: UUID(961), id: UUID(961), user_id: USER_IDS.admin, type: "WELCOME", title: "Welcome to ResolveAI", message: "Your demo admin account is ready. Use the admin dashboard to manage everything.", complaint_id: null, read: false, created_at: now },
    { _id: UUID(962), id: UUID(962), user_id: USER_IDS.manager, type: "WELCOME", title: "Welcome to ResolveAI", message: "Your demo manager account is ready. Monitor SLA and department performance.", complaint_id: null, read: false, created_at: now },
    { _id: UUID(963), id: UUID(963), user_id: USER_IDS.c1, type: "WELCOME", title: "Welcome to ResolveAI", message: "Your demo customer account is ready. Try submitting a new complaint.", complaint_id: null, read: false, created_at: now },
  );
  await c.notifications.insertMany(notificationDocs);

  await c.counters.insertOne({ _id: "complaints_seq", value: COMPLAINTS.length });
  console.log("[ResolveAI] seeded " + COMPLAINTS.length + " complaints into MongoDB");
}

