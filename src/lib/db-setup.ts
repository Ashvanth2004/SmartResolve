import { Pool } from "pg";
import { demoHash } from "@/lib/password";

/**
 * Idempotent database bootstrap: creates the schema (if missing) and seeds
 * realistic demo data (only when the database is empty). Runs automatically
 * on first server use — no manual migration step required for the demo.
 */
const DEMO = demoHash();

export const DDL = `
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  name text,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  salt text NOT NULL,
  role text NOT NULL DEFAULT 'USER',
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY,
  ticket_no text NOT NULL UNIQUE,
  seq bigint NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  category_id uuid REFERENCES categories(id),
  subcategory text,
  location text,
  contact_method text,
  priority text NOT NULL DEFAULT 'MEDIUM',
  severity text NOT NULL DEFAULT 'Medium',
  sentiment text NOT NULL DEFAULT 'Neutral',
  department_id uuid REFERENCES departments(id),
  assigned_agent_id uuid REFERENCES users(id),
  user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'NEW',
  ai_category_id uuid REFERENCES categories(id),
  ai_subcategory text,
  ai_priority text,
  ai_severity text,
  ai_sentiment text,
  ai_department_id uuid REFERENCES departments(id),
  ai_confidence real,
  ai_suggested_resolution text,
  classification_source text NOT NULL DEFAULT 'AI_GENERATED',
  needs_human_review boolean NOT NULL DEFAULT false,
  review_status text NOT NULL DEFAULT 'AWAITING',
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  sla_deadline timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  additional_info text,
  ai_analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_dept ON complaints(department_id);
CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_agent ON complaints(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_complaints_created ON complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category_id);

CREATE TABLE IF NOT EXISTS complaint_classifications (
  id uuid PRIMARY KEY,
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  category text NOT NULL,
  subcategory text,
  priority text NOT NULL,
  severity text NOT NULL,
  sentiment text NOT NULL,
  department text NOT NULL,
  confidence real NOT NULL,
  suggested_resolution text NOT NULL,
  model_version text,
  is_human_reviewed boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS complaint_messages (
  id uuid PRIMARY KEY,
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id),
  content text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  attachment_name text,
  attachment_type text,
  attachment_size integer,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS complaint_attachments (
  id uuid PRIMARY KEY,
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES users(id),
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer,
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS complaint_events (
  id uuid PRIMARY KEY,
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id),
  type text NOT NULL,
  title text NOT NULL,
  description text,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sla_rules (
  id uuid PRIMARY KEY,
  priority text NOT NULL UNIQUE,
  time_limit_hours integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  complaint_id uuid REFERENCES complaints(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY,
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  rating integer NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_feedback (
  id uuid PRIMARY KEY,
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  is_correct boolean NOT NULL,
  original_category text,
  original_priority text,
  original_department text,
  correct_category text,
  correct_priority text,
  correct_department text,
  reviewer_id uuid REFERENCES users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  entity_label text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS escalations (
  id uuid PRIMARY KEY,
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  triggered_by uuid REFERENCES users(id),
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'OPEN',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

/** Create the schema.If the the db itself is missing, create it first (connect to `postgres`). */
export async function ensureDatabase(pool: Pool): Promise<void> {
  try {
    await pool.query("SELECT 1");
  } catch {
    // Database may not exist yet — create it.
    const dbName = getDbName(process.env.DATABASE_URL || "");
    const adminPool = new Pool({
      connectionString: swapDb(process.env.DATABASE_URL || "", "postgres"),
      max: 1,
      connectionTimeoutMillis: 4000,
    });
    try {
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
    } catch { /* already exists */ }
    await adminPool.end();
    await new Promise((r) => setTimeout(r, 400));
  }
  await pool.query(DDL);

  // Every table's `id` is a uuid PRIMARY KEY. Seed/runtime inserts often omit
  // the id, so guarantee a default UUID generator on every table (idempotent).
  const ID_TABLES = [
    "departments", "users", "categories", "complaints", "complaint_classifications",
    "complaint_messages", "complaint_attachments", "complaint_events", "sla_rules",
    "notifications", "feedback", "ai_feedback", "audit_logs", "escalations",
  ];
  for (const t of ID_TABLES) {
    await pool.query(`ALTER TABLE ${t} ALTER COLUMN id SET DEFAULT gen_random_uuid()`);
  }

  const countRes = await pool.query<{ count: string }>("SELECT count(*)::int AS count FROM users");
  const count = Number(countRes.rows[0]?.count || 0);
  if (count === 0) {
    await seedDemoData(pool);
  }
  console.log("[ResolveAI] database ready (schema + demo data ensured)");
}

function getDbName(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, "");
  } catch {
    return "smart_resolve";
  }
}

function swapDb(url: string, db: string): string {
  try {
    const u = new URL(url);
    u.pathname = `/${db}`;
    return u.toString();
  } catch {
    return url;
  }
}

/** Deterministic PRNG so demo data stays stable across runs. */
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Seed data (runs once, only on first boot)
// ---------------------------------------------------------------------------
const UUID = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const DEPT_IDS: Record<string, string> = {
  cs: UUID(11), ts: UUID(12), billing: UUID(13), ops: UUID(14), sec: UUID(15),
};
const CAT_IDS: Record<string, string> = {
  tech: UUID(21), billing: UUID(22), payment: UUID(23), account: UUID(24), delivery: UUID(25),
  product: UUID(26), service: UUID(27), security: UUID(28), infra: UUID(29), staff: UUID(30), other: UUID(31),
};
const USER_IDS: Record<string, string> = {
  admin: UUID(1), manager: UUID(2), agentTech: UUID(3), agentBilling: UUID(4), agentCs: UUID(5),
  agentOps: UUID(6), agentSec: UUID(7), c1: UUID(8), c2: UUID(9), c3: UUID(10),
  c4: UUID(41), c5: UUID(42), c6: UUID(43), c7: UUID(44), c8: UUID(45),
  c9: UUID(46), c10: UUID(47),
};

async function seedDemoData(pool: Pool): Promise<void> {
  const rnd = mulberry32(20260214);

  // ---- Departments ----------------------------------------------------------------
  await pool.query(
    `INSERT INTO departments (id, name, description) VALUES
      ($1, 'Customer Support', 'Handles account, service quality, staff behaviour and general enquiries'),
      ($2, 'Technical Support', 'Handles software, hardware, network, infrastructure and app issues'),
      ($3, 'Billing & Finance', 'Handles billing, payment, refunds, and invoices'),
      ($4, 'Operations', 'Handles delivery, logistics, product fulfilment and facilities'),
      ($5, 'Security', 'Handles account security, fraud, unauthorised access and privacy')`,
    [DEPT_IDS.cs, DEPT_IDS.ts, DEPT_IDS.billing, DEPT_IDS.ops, DEPT_IDS.sec]
  );

  // ---- Categories -----------------------------------------------------------------
  await pool.query(
    `INSERT INTO categories (id, name, description, color) VALUES
      ($1, 'Technical Support', 'Software, hardware, connectivity, devices and infrastructure issues', '#6366f1'),
      ($2, 'Billing', 'Invoices, billing errors, duplicate charges, and charge disputes', '#f59e0b'),
      ($3, 'Payment', 'Payment failures, declined transactions, refunds', '#8b5cf6'),
      ($4, 'Account', 'Login, password, profile, verification, and account access issues', '#06b6d4'),
      ($5, 'Delivery', 'Late, lost, damaged shipments, and tracking problems', '#10b981'),
      ($6, 'Product', 'Defective, damaged, malfunctioning products, and quality complaints', '#f43f5e'),
      ($7, 'Service Quality', 'Slow service, rude staff, poor experience', '#ec4899'),
      ($8, 'Security', 'Unauthorised access, suspicious activity, privacy, and fraud concerns', '#ef4444'),
      ($9, 'Infrastructure', 'Power, network infrastructure, and building facilities', '#14b8a6'),
      ($10, 'Staff Behavior', 'Complaints about staff conduct, communication, professionalism', '#f97316'),
      ($11, 'Other', 'Anything that does not fit another category', '#94a3b8')`,
    [CAT_IDS.tech, CAT_IDS.billing, CAT_IDS.payment, CAT_IDS.account, CAT_IDS.delivery,
      CAT_IDS.product, CAT_IDS.service, CAT_IDS.security, CAT_IDS.infra, CAT_IDS.staff, CAT_IDS.other]
  );

  // ---- Users (admin, manager, 5 agents, 10 customers) ----------------------------
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, salt, role, department_id) VALUES
      ($1, 'Aarav Mehta', 'admin@resolveai.io', $2, $3, 'ADMIN', NULL),
      ($4, 'Priya Sharma', 'manager@resolveai.io', $2, $3, 'MANAGER', $5),
      ($6, 'Rahul Verma', 'agent@resolveai.io', $2, $3, 'AGENT', $7),
      ($8, 'Fatima Khan', 'billing.agent@resolveai.io', $2, $3, 'AGENT', $9),
      ($10, 'Arjun Nair', 'cs.agent@resolveai.io', $2, $3, 'AGENT', $11),
      ($12, 'Meera Pillai', 'ops.agent@resolveai.io', $2, $3, 'AGENT', $13),
      ($14, 'Vikram Rathore', 'security.agent@resolveai.io', $2, $3, 'AGENT', $15),
      ($16, 'Sneha Iyer', 'customer@resolveai.io', $2, $3, 'USER', NULL),
      ($17, 'Rohan Gupta', 'customer2@resolveai.io', $2, $3, 'USER', NULL),
      ($18, 'Ananya Das', 'customer3@resolveai.io', $2, $3, 'USER', NULL),
      ($19, 'Karthik Rao', 'customer4@resolveai.io', $2, $3, 'USER', NULL),
      ($20, 'Zoya Sheikh', 'customer5@resolveai.io', $2, $3, 'USER', NULL),
      ($21, 'Dev Patel', 'customer6@resolveai.io', $2, $3, 'USER', NULL),
      ($22, 'Ishita Bose', 'customer7@resolveai.io', $2, $3, 'USER', NULL),
      ($23, 'Farhan Ali', 'customer8@resolveai.io', $2, $3, 'USER', NULL),
      ($24, 'Lakshmi Menon', 'customer9@resolveai.io', $2, $3, 'USER', NULL),
      ($25, 'Nikhil Joshi', 'customer10@resolveai.io', $2, $3, 'USER', NULL)`,
    [USER_IDS.admin, DEMO.hash, DEMO.salt, USER_IDS.manager, DEPT_IDS.billing,
      USER_IDS.agentTech, DEPT_IDS.ts, USER_IDS.agentBilling, DEPT_IDS.billing,
      USER_IDS.agentCs, DEPT_IDS.cs, USER_IDS.agentOps, DEPT_IDS.ops,
      USER_IDS.agentSec, DEPT_IDS.sec, USER_IDS.c1, USER_IDS.c2, USER_IDS.c3,
      USER_IDS.c4, USER_IDS.c5, USER_IDS.c6, USER_IDS.c7, USER_IDS.c8,
      USER_IDS.c9, USER_IDS.c10]
  );

  // ---- SLA rules --------------------------------------------------------------------
  await pool.query(
    `INSERT INTO sla_rules (priority, time_limit_hours, is_active) VALUES
      ('CRITICAL', 4, true), ('HIGH', 12, true), ('MEDIUM', 24, true), ('LOW', 72, true)`
  );

  // ---- Complaint dataset (filled in increments below) -------------------------------
  // Tuple: [title, description, catKey, subcat, prio, sev, sent, deptKey, status, needsReview, source, resolution]
  const COMPLAINTS: any[] = [];

  COMPLAINTS.push(
    ["Payment deducted but order not confirmed", "I was charged on my card but my order was never confirmed and there is no order ID in my account.", "payment", "Failed Transaction", "HIGH", "High", "Negative", "billing", "IN_PROGRESS", false, "AI_GENERATED", "Verify the payment with the gateway, check whether the amount was captured, confirm or refund the order, and inform the customer."],
    ["Internet connection keeps disconnecting", "My internet connection has been disconnecting several times every evening for the past week, dropping my video calls.", "tech", "Internet Connectivity", "HIGH", "Medium", "Negative", "ts", "ASSIGNED", false, "AI_GENERATED", "Check router logs and network stability, test the signal strength, then re-route the connection if needed."],
    ["Package has not arrived yet", "My order was dispatched 10 days ago but the tracking has not updated since. The package has not arrived.", "delivery", "Lost Shipment", "MEDIUM", "Medium", "Negative", "ops", "ESCALATED", false, "AI_GENERATED", "Trace the shipment with the carrier, confirm the delivery address, and initiate a replacement or refund."],
    ["Unable to reset my account password", "I am unable to reset my password. The reset link expires immediately and I have tried several times.", "account", "Password Reset", "HIGH", "Medium", "Negative", "cs", "IN_PROGRESS", false, "AI_GENERATED", "Confirm the registered email, regenerate a fresh reset token, and check email filtering rules."],
    ["Charged twice for the same transaction", "I noticed my account was charged twice for the same subscription payment this month.", "billing", "Duplicate Charge", "HIGH", "Medium", "Very Negative", "billing", "IN_PROGRESS", false, "AI_GENERATED", "Compare both transaction IDs, reverse the duplicate charge, and confirm the refund to the customer."],
    ["Service was extremely slow today", "The entire application has been extremely slow all day. Every page takes over a minute to load.", "service", "Performance", "CRITICAL", "High", "Very Negative", "ts", "ESCALATED", false, "AI_GENERATED", "Check server CPU and database load, scale resources, and review recent deployments for regressions."],
    ["Unauthorized login detected on my account", "I received an email about a login from a new device that I do not recognise. Someone may have accessed my account.", "security", "Unauthorized Access", "CRITICAL", "Critical", "Very Negative", "sec", "ESCALATED", true, "AI_GENERATED", "Force a password reset, revoke active sessions, enable 2FA, and review account access logs."],
    ["Received a damaged product", "The product I received was damaged. The box was crushed and the item inside is broken.", "product", "Damaged Item", "MEDIUM", "Medium", "Negative", "ops", "ASSIGNED", false, "AI_GENERATED", "Request photos of the damage, arrange a replacement or refund, and file a claim with the courier."],
    ["Refund has not been credited", "I returned the product two weeks ago but the refund has still not been credited to my account.", "payment", "Refund", "HIGH", "Medium", "Negative", "billing", "IN_PROGRESS", false, "AI_GENERATED", "Check the return intake date, verify the refund initiation, and expedite the credit."],
    ["Unable to update my profile", "I keep getting an error when I try to save changes to my profile, so I cannot update my address.", "account", "Profile Update", "MEDIUM", "Low", "Neutral", "cs", "NEW", false, "AI_GENERATED", "Reproduce the profile save flow, check validation rules, and fix the blocking error."],
    ["App crashes on checkout", "Every time I reach the checkout screen the mobile app crashes before I can complete payment.", "tech", "Mobile App", "HIGH", "High", "Negative", "ts", "IN_PROGRESS", false, "AI_GENERATED", "Reproduce the checkout crash, inspect crash logs, and deploy a hotfix."],
    ["Wrong amount charged on invoice", "My latest invoice shows a charge that does not match my plan. It is higher than what I agreed to.", "billing", "Invoice Dispute", "HIGH", "Medium", "Negative", "billing", "ASSIGNED", false, "AI_GENERATED", "Compare the invoice line items with the agreed plan and correct any discrepancy."],
    ["Network outage across the building", "The entire office network has been down for the last two hours and nobody can access any internal system.", "infra", "Outage", "CRITICAL", "Critical", "Very Negative", "ts", "ESCALATED", false, "AI_GENERATED", "Escalate to the infrastructure team, check the core switch and uplink, and communicate status to affected users."],
    ["Offensive behaviour by support representative", "The support representative spoke to me rudely and ended the chat without resolving my issue.", "staff", "Staff Conduct", "MEDIUM", "Medium", "Very Negative", "cs", "NEW", false, "AI_GENERATED", "Review the chat transcript, speak with the representative, and offer an apology to the customer."],
    ["Deactivated account without notice", "My account was deactivated without any email or explanation. I cannot login at all now.", "account", "Account Access", "CRITICAL", "High", "Very Negative", "cs", "IN_PROGRESS", true, "HUMAN_CORRECTED", "Check for automated deactivation flags, restore access, and notify the customer of the reason."],
    ["Order cancelled but still charged", "My order was cancelled by the system but I was still charged for it. I want my money back.", "payment", "Refund", "HIGH", "Medium", "Very Negative", "billing", "IN_PROGRESS", false, "AI_GENERATED", "Confirm the cancellation, reverse the hold, and issue a refund."],
    ["Slow internet in remote office", "The remote office internet is very slow and video conferencing keeps dropping during meetings.", "tech", "Internet Connectivity", "MEDIUM", "Medium", "Negative", "ts", "ASSIGNED", false, "AI_GENERATED", "Check the remote link bandwidth and router and upgrade the connection if necessary."],
    ["Did not receive promotional discount", "The promotion code I was promised was not applied to my purchase and I was charged full price.", "billing", "Pricing", "LOW", "Low", "Neutral", "billing", "NEW", false, "AI_GENERATED", "Verify the promotion eligibility and refund the difference."],
    ["Faulty laptop battery", "My laptop battery drains within 30 minutes even when fully charged. It is less than a year old.", "tech", "Hardware", "MEDIUM", "Medium", "Negative", "ts", "ASSIGNED", false, "AI_GENERATED", "Diagnose the battery health and arrange a warranty replacement."],
    ["Received wrong item in my order", "I ordered a black model but received a silver one. The package contents are incorrect.", "delivery", "Wrong Item", "MEDIUM", "Medium", "Negative", "ops", "IN_PROGRESS", false, "AI_GENERATED", "Confirm the ordered versus shipped item and arrange the correct item or a return."],
    ["CEO impersonation phishing email", "A phishing email pretending to be from our CEO is being sent to staff. It asks people to buy gift cards.", "security", "Phishing", "CRITICAL", "Critical", "Negative", "sec", "ESCALATED", true, "HUMAN_CORRECTED", "Warn all staff, block the sender, and add the domain to the blocklist."],
    ["Subscription renewal failure", "My subscription renewed with an error and I was locked out of the premium features I paid for.", "payment", "Renewal", "HIGH", "Medium", "Negative", "billing", "IN_PROGRESS", false, "AI_GENERATED", "Verify the renewal payment, restore premium access, and confirm the next renewal date."],
    ["App does not support dark mode", "The mobile app does not have a dark mode option, which makes it hard to use at night.", "tech", "Feature Request", "LOW", "Low", "Neutral", "ts", "NEW", false, "AI_GENERATED", "Log the feature request and share the roadmap timeline with the customer."],
    ["Elevator out of service", "The office elevator has been out of service for three days, forcing staff to use the stairs.", "infra", "Facilities", "MEDIUM", "Medium", "Neutral", "ops", "ASSIGNED", false, "AI_GENERATED", "Contact the maintenance contractor and provide an estimated repair date."],
    ["Multiple failed login attempts", "I keep seeing failed login attempts on my account from an unknown location. I am worried it will be hacked.", "security", "Suspicious Activity", "HIGH", "High", "Negative", "sec", "IN_PROGRESS", false, "AI_GENERATED", "Freeze the account, reset credentials, and investigate the source of the attempts."],
    ["Late delivery of medical supplies", "Our urgent medical order was supposed to arrive yesterday but it is stuck in transit and patients are affected.", "delivery", "Urgent Delivery", "CRITICAL", "Critical", "Very Negative", "ops", "ESCALATED", false, "AI_GENERATED", "Escalate to expedited delivery and provide a clear revised ETA."],
    ["Billing department unresponsive", "I have emailed the billing department 3 times about a refund and nobody has responded in over a week.", "staff", "Unresponsiveness", "HIGH", "Medium", "Very Negative", "cs", "NEW", true, "AI_GENERATED", "Route to a supervisor, respond to the customer, and prioritise the pending refund."],
    ["Feature request: offline mode", "It would help a lot if the app had an offline mode so I can continue working without internet.", "tech", "Feature Request", "LOW", "Low", "Positive", "ts", "NEW", false, "AI_GENERATED", "Add to the product backlog and acknowledge the request."],
    ["Cannot find my invoice PDF", "I need a copy of my last invoice for accounting but I cannot find it in the app.", "billing", "Document Access", "LOW", "Low", "Neutral", "billing", "NEW", false, "AI_GENERATED", "Locate the invoice and provide a downloadable PDF."],
    ["Hot water not working in washroom", "The washroom on the ground floor has no hot water. It has been like this for a week.", "infra", "Facilities", "MEDIUM", "Low", "Neutral", "ops", "ASSIGNED", false, "AI_GENERATED", "Raise a maintenance ticket with the plumbing contractor."],
    ["Friend's referral bonus not credited", "I referred a friend who signed up but I never received the referral bonus I was promised.", "account", "Promotion", "LOW", "Low", "Neutral", "cs", "NEW", false, "AI_GENERATED", "Verify the referral was valid and credit the bonus."],
    ["Delay in ticket support response", "I opened a technical ticket 4 days ago and still have not received a response from the support team.", "staff", "Unresponsiveness", "MEDIUM", "Medium", "Negative", "cs", "ESCALATED", false, "AI_GENERATED", "Assign the ticket to an available agent and provide an update to the customer."],
    ["Cannot upload a document to my profile", "Every time I try to upload my ID document for verification it fails with a generic error.", "account", "Verification", "MEDIUM", "Medium", "Neutral", "cs", "IN_PROGRESS", false, "AI_GENERATED", "Test the upload flow and fix the file size or format validation."],
    ["Charged for a free trial", "I signed up for a free trial but I was charged on the first day instead of at the end of the trial.", "billing", "Billing Error", "HIGH", "Medium", "Very Negative", "billing", "IN_PROGRESS", false, "AI_GENERATED", "Check the trial configuration and reverse the erroneous charge."],
    ["WiFi drops on the third floor", "The WiFi keeps dropping on the third floor conference rooms making it impossible to hold calls.", "tech", "Internet Connectivity", "MEDIUM", "Medium", "Negative", "ts", "ASSIGNED", false, "AI_GENERATED", "Check access point coverage on the third floor and adjust placement."],
    ["Change of address not reflected", "I moved last month and updated my address, but my bills are still being sent to the old address.", "account", "Profile Update", "MEDIUM", "Low", "Neutral", "cs", "NEW", false, "AI_GENERATED", "Confirm the new address is saved on all systems and update billing details."],
    ["App logs out after every restart", "I have to login again every time I restart my phone. My session never stays logged in.", "tech", "Mobile App", "MEDIUM", "Medium", "Negative", "ts", "ASSIGNED", false, "AI_GENERATED", "Investigate the token refresh flow and fix session persistence."],
    ["Payout notification not received", "I did not receive the payout notification this month even though others did. I want to check my account.", "service", "Notification Issue", "MEDIUM", "Low", "Neutral", "cs", "NEW", true, "HUMAN_CORRECTED", "Check notification preferences and re-send the payout notice."],
    ["Report a data privacy concern", "I am concerned that my personal data may have been shared without my consent after a recent support call.", "security", "Privacy", "HIGH", "High", "Very Negative", "sec", "IN_PROGRESS", false, "AI_GENERATED", "Review data access logs and initiate a privacy review."],
    ["Request to close duplicate account", "I accidentally created two accounts. I would like to close the duplicate one and merge my data.", "account", "Account Merge", "LOW", "Low", "Neutral", "cs", "NEW", false, "AI_GENERATED", "Verify both accounts belong to the customer and merge or close as requested."],
    ["Printer not printing in Finance", "The printer in the Finance department is not printing and shows an offline error.", "tech", "Printer", "MEDIUM", "Low", "Neutral", "ts", "ASSIGNED", false, "AI_GENERATED", "Check the printer connection and clear the offline state."],
    ["Very long wait on support call", "I waited 35 minutes on hold to talk to support, which is unacceptable for an urgent billing issue.", "staff", "Service Quality", "HIGH", "Medium", "Very Negative", "cs", "NEW", false, "AI_GENERATED", "Review staffing and queue routing to reduce hold times."],
    ["Order marked delivered but not received", "My package was marked as delivered but I never received it. The delivery photo shows the wrong door.", "delivery", "Delivery Dispute", "HIGH", "High", "Very Negative", "ops", "ESCALATED", false, "AI_GENERATED", "Open a carrier investigation and arrange a re-delivery or refund."],
    ["Auto-payment charged before due date", "My auto-payment was charged 2 days before the due date leaving my account short.", "billing", "Billing Error", "MEDIUM", "Medium", "Negative", "billing", "IN_PROGRESS", false, "AI_GENERATED", "Check the payment schedule and correct the charge date."],
    ["Missing feature in admin console", "The admin console does not have a bulk export option which makes monthly reporting very slow.", "tech", "Feature Request", "LOW", "Low", "Neutral", "ts", "NEW", true, "HUMAN_CORRECTED", "Add the bulk export feature to the product backlog and share the planned timeline."],
    ["Suspicious charge on my statement", "I found a small charge on my card that I do not recognise. I want to confirm it is not fraudulent.", "security", "Fraud", "HIGH", "High", "Very Negative", "sec", "IN_PROGRESS", false, "AI_GENERATED", "Verify the transaction details and investigate whether it is fraudulent."],
    ["Cannot change my email address", "The app will not let me change the email address on my account. It says the field is locked.", "account", "Account Access", "MEDIUM", "Low", "Neutral", "cs", "NEW", false, "AI_GENERATED", "Verify the customer and unlock the email change flow."],
    ["Request refund for cancelled service", "I cancelled my service but I was still charged for the next month. I need a refund for the unused period.", "payment", "Refund", "HIGH", "Medium", "Negative", "billing", "IN_PROGRESS", false, "AI_GENERATED", "Confirm the cancellation date and refund the unused period."],
    ["Training session didn't start on time", "The training session started 20 minutes late with poor audio quality, which impacted the attendees.", "staff", "Service Quality", "LOW", "Low", "Neutral", "cs", "NEW", false, "HUMAN_CORRECTED", "Review the event logistics and coordinate with the presenter."],
    ["Unable to scan QR code in app", "The QR code in the app will not scan at the entry gate, preventing me from entering the building.", "tech", "Mobile App", "HIGH", "Medium", "Negative", "ts", "ASSIGNED", false, "AI_GENERATED", "Fix the QR generation and confirm the device display settings."],
    ["Duplicate report entries in my account", "I see the same report several times listed in my account. It looks like a display bug.", "tech", "Software Bug", "LOW", "Low", "Neutral", "ts", "NEW", false, "AI_GENERATED", "Investigate the duplicate entries and clean the account data."],
    ["Refund still not received after 3 weeks", "It has been 3 weeks since my return was accepted and I still have not received my refund.", "payment", "Refund", "HIGH", "High", "Very Negative", "billing", "ESCALATED", false, "AI_GENERATED", "Trace the refund through the payment provider and escalate if needed."],
    ["Account locked after password change", "I changed my password successfully but now my account is locked and I cannot login.", "account", "Account Access", "HIGH", "High", "Negative", "cs", "IN_PROGRESS", false, "AI_GENERATED", "Unlock the account and confirm the password change is saved."],
    ["Employee badge not working", "My office badge stops working at the main entrance every few days and I have to ask security to let me in.", "infra", "Access Control", "MEDIUM", "Low", "Neutral", "ops", "ASSIGNED", false, "AI_GENERATED", "Re-program the badge and check the door controller logs."],
    ["Request information about my spending", "I want a breakdown of my spending for the last six months for my personal records.", "billing", "Statement Request", "LOW", "Low", "Positive", "billing", "NEW", false, "AI_GENERATED", "Generate and share the spending statement."],
    ["Received spam notifications in app", "I have been receiving spam-like notifications in the app promoting offers I did not opt into.", "service", "Notifications", "LOW", "Low", "Negative", "cs", "NEW", false, "AI_GENERATED", "Check notification opt-in settings and stop unsolicited messages."],
    ["Issues with conference room booking", "The conference room booking system is double-booking rooms and showing rooms as free when they are occupied.", "tech", "Software Bug", "MEDIUM", "Medium", "Negative", "ts", "ASSIGNED", false, "AI_GENERATED", "Fix the booking conflict logic and audit recent bookings."],
    ["Help understanding my usage bill", "I do not understand some of the line items on my usage bill and I want an explanation.", "billing", "Invoice Dispute", "LOW", "Low", "Neutral", "billing", "NEW", false, "AI_GENERATED", "Explain each line item and clarify the charges."]
  );

  const AGENTS = [USER_IDS.agentTech, USER_IDS.agentBilling, USER_IDS.agentCs, USER_IDS.agentOps, USER_IDS.agentSec];
  const CUSTOMERS = [USER_IDS.c1, USER_IDS.c2, USER_IDS.c3, USER_IDS.c4, USER_IDS.c5,
                     USER_IDS.c6, USER_IDS.c7, USER_IDS.c8, USER_IDS.c9, USER_IDS.c10];
  const REVIEWERS = [USER_IDS.manager, USER_IDS.agentTech, USER_IDS.agentBilling, USER_IDS.agentCs, USER_IDS.admin];
  const SLA_HOURS: Record<string, number> = { CRITICAL: 4, HIGH: 12, MEDIUM: 24, LOW: 72 };
  const DEPT_NAME: Record<string, string> = {
    cs: "Customer Support", ts: "Technical Support", billing: "Billing & Finance", ops: "Operations", sec: "Security",
  };

  for (let i = 0; i < COMPLAINTS.length; i++) {
    const [title, description, catKey, subcat, prio, sev, sent, deptKey, status, needsReview, src, resolution] = COMPLAINTS[i];
    const catId = CAT_IDS[catKey];
    const deptId = DEPT_IDS[deptKey];
    const corrected = src === "HUMAN_CORRECTED";
    const daysAgo = 1 + Math.floor(rnd() * 25);
    const hoursAgo = Math.floor(rnd() * 16);
    const createdAt = new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000);
    const slaH = SLA_HOURS[prio] || 24;
    const slaDeadlineMs = createdAt.getTime() + slaH * 3600000;

    let statusEff = status;
    const r = rnd();
    if ((status === "ASSIGNED" || status === "IN_PROGRESS") && r > 0.85) statusEff = "ESCALATED";
    if (status === "IN_PROGRESS" && r > 0.6 && r < 0.68) statusEff = "WAITING";

    const resolved = statusEff === "RESOLVED" || statusEff === "CLOSED";
    const closedLate = resolved && r > 0.7;
    const slaDeadline = statusEff === "NEW" || statusEff === "AI_ANALYZED" ? null : new Date(slaDeadlineMs);
    const resolvedAt = resolved ? new Date(slaDeadlineMs + (closedLate ? 1 : -1) * (1 + Math.floor(rnd() * 10)) * 3600000) : null;
    const assignee = ["ASSIGNED", "IN_PROGRESS", "WAITING", "ESCALATED"].includes(statusEff) ? AGENTS[Math.floor(rnd() * AGENTS.length)] : null;
    const customerId = CUSTOMERS[i % CUSTOMERS.length];
    const confidence = needsReview ? 42 + Math.floor(rnd() * 26) : 80 + Math.floor(rnd() * 20);

    const cid = UUID(100 + i);
    const ticketNo = "RA-" + (1001 + i);

    await pool.query(
      `INSERT INTO complaints (id, ticket_no, seq, title, description, category_id, subcategory, priority, severity, sentiment, department_id,
         assigned_agent_id, user_id, status, ai_category_id, ai_subcategory, ai_priority, ai_severity, ai_sentiment, ai_department_id,
         ai_confidence, ai_suggested_resolution, classification_source, needs_human_review, review_status, reviewed_by, reviewed_at,
         sla_deadline, resolved_at, ai_analyzed_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)`,
      [cid, ticketNo, i + 1, title, description, catId, subcat, prio, sev, sent, deptId,
        assignee, customerId, statusEff, catId, subcat, prio, sev, sent, deptId,
        Math.round(confidence) / 100, resolution, corrected ? "HUMAN_CORRECTED" : "AI_GENERATED", needsReview,
        corrected ? "REVIEWED" : needsReview ? "AWAITING" : "NOT_REQUIRED",
        corrected ? REVIEWERS[i % REVIEWERS.length] : null, corrected ? createdAt : null,
        slaDeadline, resolvedAt,
        new Date(createdAt.getTime() + (1 + Math.floor(rnd() * 5)) * 60000),
        createdAt, createdAt]
    );

    await insertClassification(pool, cid, catKey, subcat, prio, sent, deptKey, confidence, resolution, corrected, i);
    await insertEvents(pool, cid, customerId, assignee, statusEff, createdAt, resolved, i, corrected ? REVIEWERS[i % REVIEWERS.length] : null);
  }
  console.log("[ResolveAI] seeded " + COMPLAINTS.length + " complaints");

  await seedFeedbackAndAudit(pool, rnd, COMPLAINTS, CUSTOMERS, REVIEWERS, AGENTS);
  console.log("[ResolveAI] seed complete");
}

type RndFn = () => number;

async function insertClassification(
  pool: Pool, cid: string, catKey: string, subcat: string, prio: string, sent: string, deptKey: string,
  confidence: number, resolution: string, corrected: boolean, _i: number
): Promise<void> {
  const deptName = {
    cs: "Customer Support", ts: "Technical Support", billing: "Billing & Finance", ops: "Operations", sec: "Security",
  }[deptKey];
  await pool.query(
    `INSERT INTO complaint_classifications (complaint_id, category, subcategory, priority, severity, sentiment, department, confidence, suggested_resolution, model_version, is_human_reviewed, reviewed_by)
     VALUES ($1,$2,$3,$4,'Medium',$5,$6,$7,$8,$9,$10,$11)`,
    [cid, catKey, subcat, prio, sent, deptName, confidence / 100, resolution,
     "semantic-taxonomy-v1", corrected, corrected ? USER_IDS.manager : null]
  );
}

async function insertEvents(
  pool: Pool, cid: string, customerId: string, assignee: string | null, status: string,
  createdAt: Date, resolved: boolean, i: number, reviewer: string | null
): Promise<void> {
  const t0 = createdAt.getTime();
  const at = (mins: number) => new Date(t0 + mins * 60000);
  await pool.query(
    `INSERT INTO complaint_events (complaint_id, actor_id, type, title, description, created_at) VALUES ($1,$2,'CREATED','Complaint submitted','Complaint created by the customer.',$3)`,
    [cid, customerId, at(0)]
  );
  await pool.query(
    `INSERT INTO complaint_events (complaint_id, actor_id, type, title, description, created_at) VALUES ($1,NULL,'AI_CLASSIFIED','AI classified complaint','AI analysed the text and recommended a category, priority and department.',$2)`,
    [cid, at(1)]
  );
  if (assignee) {
    await pool.query(
      `INSERT INTO complaint_events (complaint_id, actor_id, type, title, description, old_value, new_value, created_at) VALUES ($1,NULL,'ASSIGNED','Assigned to department','Routed to the recommended department and queued.',NULL,$2,$3)`,
      [cid, "AI routing", at(2)]
    );
  }
  const stage = ["ASSIGNED", "IN_PROGRESS", "WAITING", "ESCALATED"].includes(status);
  let mins = 3;
  if (stage) {
    await pool.query(
      `INSERT INTO complaint_events (complaint_id, actor_id, type, title, description, old_value, new_value, created_at) VALUES ($1,$2,'STATUS_CHANGE','Status changed','Agent updated the complaint status.',NULL,$3,$4)`,
      [cid, assignee || reviewer, status, at(mins)]
    );
    mins += 40;
  }
  if (resolved) {
    await pool.query(
      `INSERT INTO complaint_events (complaint_id, actor_id, type, title, description, old_value, new_value, created_at) VALUES ($1,$2,'RESOLUTION','Complaint resolved','Issue was resolved by the agent.',NULL,$3,$4)`,
      [cid, assignee || reviewer, "RESOLVED", at(mins)]
    );
  }
  if (i % 4 === 0) {
    await pool.query(
      `INSERT INTO complaint_messages (complaint_id, author_id, content, is_internal, created_at) VALUES ($1,$2,$3,false,$4)`,
      [cid, customerId, "Please keep me updated on the progress of this issue. Thank you.", at(mins + 20)]
    );
  }
}

async function seedFeedbackAndAudit(
  pool: Pool, rnd: RndFn, complaints: any[], customers: string[], reviewers: string[], agents: string[]
): Promise<void> {
  // Customer satisfaction feedback on many complaints.
  for (let i = 0; i < complaints.length; i++) {
    if (i % 3 !== 0) {
      const rating = 3 + Math.floor(rnd() * 3);
      await pool.query(
        `INSERT INTO feedback (complaint_id, user_id, rating, comment) VALUES ($1,$2,$3,$4)`,
        [UUID(100 + i), customers[i % customers.length], rating >= 5 ? 5 : rating,
         rating >= 4 ? "Resolved quickly and courteously." : "Issue was fixed but could be faster."]
      );
    }
    if (i % 4 === 0) {
      await pool.query(
        `INSERT INTO ai_feedback (complaint_id, is_correct, original_category, original_priority, original_department, correct_category, correct_priority, correct_department, reviewer_id, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [UUID(100 + i), true, complaints[i][2], complaints[i][4], complaints[i][7], complaints[i][2], complaints[i][4], complaints[i][7], reviewers[i % reviewers.length], "AI classification was accurate."]
      );
    }
    if (i % 7 === 3) {
      await pool.query(
        `INSERT INTO ai_feedback (complaint_id, is_correct, original_category, original_priority, original_department, correct_category, correct_priority, correct_department, reviewer_id, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [UUID(100 + i), false, complaints[i][2], complaints[i][4], complaints[i][7], "Billing & Finance", complaints[i][4], complaints[i][7], reviewers[i % reviewers.length], "Misclassified the department."]
      );
    }
  }

  const actions = ["LOGIN", "COMPLAINT_VIEW", "STATUS_CHANGE", "CLASSIFICATION", "ASSIGNMENT", "ESCALATION", "MESSAGE", "RESOLUTION"];
  for (let i = 0; i < 45; i++) {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_label, details, created_at)
       SELECT $1,$2,'complaint',title,$3,$4 FROM complaints WHERE seq = $5`,
      [reviewers[i % reviewers.length], actions[i % actions.length],
       "Demo audit trail entry for a complaint workflow action.",
       new Date(Date.now() - (i + 1) * 3600000), (i % 60) + 1]
    );
  }

  const notifDefs = [
    ["SLA_APPROACHING", "SLA deadline approaching", "Please review the open complaints with expiring SLAs."],
    ["COMPLAINT_ASSIGNED", "New complaint assigned", "A new complaint has been assigned to your queue."],
    ["COMPLAINT_ESCALATED", "Complaint escalated", "A high priority complaint was escalated for review."],
    ["SLA_BREACHED", "SLA breached", "A complaint has exceeded its SLA deadline."],
  ];
  for (let i =    0; i < 8; i++) {
    const nd = notifDefs[i % notifDefs.length];
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, complaint_id, read, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [agents[i % agents.length], nd[0], nd[1], nd[2], UUID(100 + i), i % 2 === 0,
       new Date(Date.now() - (i + 1) * 7200000)]
    );
  }
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, message, read) VALUES
      ($1,'WELCOME','Welcome to ResolveAI','Your demo agent account is ready. Explore assigned complaints.',false),
      ($2,'WELCOME','Welcome to ResolveAI','Your demo admin account is ready. Use the admin dashboard to manage everything.',false),
      ($3,'WELCOME','Welcome to ResolveAI','Your demo manager account is ready. Monitor SLA and department performance.',false),
      ($4,'WELCOME','Welcome to ResolveAI','Your demo customer account is ready. Try submitting a new complaint.',false)`,
    [USER_IDS.agentTech, USER_IDS.admin, USER_IDS.manager, USER_IDS.c1]
  );
}