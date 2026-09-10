import type { Collections } from "@/lib/mongodb";

/** Create all indexes (idempotent). Field names mirror the old SQL columns. */
export async function ensureIndexes(c: Collections): Promise<void> {
  await c.users.createIndex({ id: 1 }, { unique: true });
  await c.users.createIndex({ email: 1 }, { unique: true });
  await c.departments.createIndex({ id: 1 }, { unique: true });
  await c.departments.createIndex({ name: 1 }, { unique: true });
  await c.categories.createIndex({ id: 1 }, { unique: true });
  await c.categories.createIndex({ name: 1 }, { unique: true });
  await c.complaints.createIndex({ id: 1 }, { unique: true });
  await c.complaints.createIndex({ ticket_no: 1 }, { unique: true });
  await c.complaints.createIndex({ seq: 1 }, { unique: true });
  await c.complaints.createIndex({ status: 1 });
  await c.complaints.createIndex({ priority: 1 });
  await c.complaints.createIndex({ department_id: 1 });
  await c.complaints.createIndex({ user_id: 1 });
  await c.complaints.createIndex({ assigned_agent_id: 1 });
  await c.complaints.createIndex({ category_id: 1 });
  await c.complaints.createIndex({ created_at: -1 });
  await c.complaints.createIndex({ sla_deadline: 1 });
  await c.complaint_classifications.createIndex({ complaint_id: 1 });
  await c.complaint_messages.createIndex({ complaint_id: 1 });
  await c.complaint_attachments.createIndex({ complaint_id: 1 });
  await c.complaint_events.createIndex({ complaint_id: 1 });
  await c.sla_rules.createIndex({ priority: 1 }, { unique: true });
  await c.notifications.createIndex({ user_id: 1, created_at: -1 });
  await c.feedback.createIndex({ complaint_id: 1 });
  await c.ai_feedback.createIndex({ complaint_id: 1 });
  await c.audit_logs.createIndex({ created_at: -1 });
  await c.escalations.createIndex({ complaint_id: 1 });
  // Email verification tokens — TTL auto-expires documents after 15 minutes
  await c.email_verification_tokens.createIndex({ token: 1 }, { unique: true });
  await c.email_verification_tokens.createIndex({ user_id: 1 });
  await c.email_verification_tokens.createIndex(
    { expires_at: 1 },
    { expireAfterSeconds: 0 } // MongoDB removes doc when expires_at is past
  );
}
