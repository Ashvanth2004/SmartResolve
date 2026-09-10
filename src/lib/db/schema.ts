import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  boolean,
  uuid,
  bigserial,
} from "drizzle-orm/pg-core";

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  role: text("role").notNull().default("USER"),
  departmentId: uuid("department_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const complaints = pgTable("complaints", {
  id: uuid("id").primaryKey(),
  ticketNo: text("ticket_no").notNull().unique(),
  seq: bigserial("seq", { mode: "number" }).notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  categoryId: uuid("category_id"),
  subcategory: text("subcategory"),
  location: text("location"),
  contactMethod: text("contact_method"),
  priority: text("priority").notNull().default("MEDIUM"),
  severity: text("severity").notNull().default("Medium"),
  sentiment: text("sentiment").notNull().default("Neutral"),
  departmentId: uuid("department_id"),
  assignedAgentId: uuid("assigned_agent_id"),
  userId: uuid("user_id").notNull(),
  status: text("status").notNull().default("NEW"),
  aiCategoryId: uuid("ai_category_id"),
  aiSubcategory: text("ai_subcategory"),
  aiPriority: text("ai_priority"),
  aiSeverity: text("ai_severity"),
  aiSentiment: text("ai_sentiment"),
  aiDepartmentId: uuid("ai_department_id"),
  aiConfidence: real("ai_confidence"),
  aiSuggestedResolution: text("ai_suggested_resolution"),
  classificationSource: text("classification_source").notNull().default("AI_GENERATED"),
  needsHumanReview: boolean("needs_human_review").notNull().default(false),
  reviewStatus: text("review_status").notNull().default("AWAITING"),
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  slaDeadline: timestamp("sla_deadline", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  additionalInfo: text("additional_info"),
  aiAnalyzedAt: timestamp("ai_analyzed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const complaintClassifications = pgTable("complaint_classifications", {
  id: uuid("id").primaryKey(),
  complaintId: uuid("complaint_id").notNull(),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  priority: text("priority").notNull(),
  severity: text("severity"),
  sentiment: text("sentiment"),
  department: text("department").notNull(),
  confidence: real("confidence").notNull(),
  suggestedResolution: text("suggested_resolution").notNull(),
  modelVersion: text("model_version"),
  isHumanReviewed: boolean("is_human_reviewed").notNull().default(false),
  reviewedBy: uuid("reviewed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const complaintMessages = pgTable("complaint_messages", {
  id: uuid("id").primaryKey(),
  complaintId: uuid("complaint_id").notNull(),
  authorId: uuid("author_id").notNull(),
  content: text("content").notNull(),
  isInternal: boolean("is_internal").notNull().default(false),
  attachmentName: text("attachment_name"),
  attachmentType: text("attachment_type"),
  attachmentSize: integer("attachment_size"),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const complaintAttachments = pgTable("complaint_attachments", {
  id: uuid("id").primaryKey(),
  complaintId: uuid("complaint_id").notNull(),
  uploaderId: uuid("uploader_id").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const complaintEvents = pgTable("complaint_events", {
  id: uuid("id").primaryKey(),
  complaintId: uuid("complaint_id").notNull(),
  actorId: uuid("actor_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const slaRules = pgTable("sla_rules", {
  id: uuid("id").primaryKey(),
  priority: text("priority").notNull().unique(),
  timeLimitHours: integer("time_limit_hours").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message"),
  complaintId: uuid("complaint_id"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey(),
  complaintId: uuid("complaint_id").notNull(),
  userId: uuid("user_id").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const aiFeedback = pgTable("ai_feedback", {
  id: uuid("id").primaryKey(),
  complaintId: uuid("complaint_id").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  originalCategory: text("original_category"),
  originalPriority: text("original_priority"),
  originalDepartment: text("original_department"),
  correctCategory: text("correct_category"),
  correctPriority: text("correct_priority"),
  correctDepartment: text("correct_department"),
  reviewerId: uuid("reviewer_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  entityLabel: text("entity_label"),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const escalations = pgTable("escalations", {
  id: uuid("id").primaryKey(),
  complaintId: uuid("complaint_id").notNull(),
  triggeredBy: uuid("triggered_by"),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status").notNull().default("OPEN"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});