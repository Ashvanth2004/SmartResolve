import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth-config";
import { collections } from "@/lib/mongodb";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  departmentId?: string | null;
};

/** Roles with their privilege ordering. */
export const ROLE_ORDER: Record<string, number> = { USER: 0, AGENT: 1, MANAGER: 2, ADMIN: 3 };

export async function getSession(): Promise<SessionUser | null> {
  const auth = authConfig.auth;
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as any;
  return {
    id: u.id as string,
    email: u.email as string,
    name: u.name,
    role: (u.role as string) || "USER",
    departmentId: (u.departmentId as string | null) || null,
  };
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function ok(data: Record<string, unknown> = { success: true }, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * Require an authenticated user; optionally require a minimum role.
 * Returns null when authorised, otherwise an error NextResponse.
 */
export async function requireAuth(
  minRole?: "USER" | "AGENT" | "MANAGER" | "ADMIN"
): Promise<SessionUser | NextResponse> {
  const user = await getSession();
  if (!user) return err("Authentication required. Please sign in.", 401);
  if (minRole && (ROLE_ORDER[user.role] ?? 0) < ROLE_ORDER[minRole]) {
    return err("You don't have permission to perform this action.", 403);
  }
  return user;
}

export async function audit(
  user: SessionUser | null,
  action: string,
  entityType?: string,
  entityId?: string,
  entityLabel?: string,
  details?: string
): Promise<void> {
  try {
    const { audit_logs } = await collections();
    await audit_logs.insertOne({
      _id: crypto.randomUUID(),
      id: crypto.randomUUID(),
      user_id: user?.id ?? null,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      entity_label: entityLabel ?? null,
      details: details ?? null,
      created_at: new Date(),
    });
  } catch (e) {
    console.error("[audit] failed:", e);
  }
}

export async function addEvent(
  complaintId: string,
  type: string,
  title: string,
  description?: string,
  actorId?: string | null,
  oldValue?: string | null,
  newValue?: string | null
): Promise<void> {
  try {
    const { complaint_events } = await collections();
    await complaint_events.insertOne({
      _id: crypto.randomUUID(),
      id: crypto.randomUUID(),
      complaint_id: complaintId,
      actor_id: actorId ?? null,
      type,
      title,
      description: description ?? null,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
      created_at: new Date(),
    });
  } catch (e) {
    console.error("[event] failed:", e);
  }
}

export async function notify(
  userId: string,
  type: string,
  title: string,
  message?: string,
  complaintId?: string | null
): Promise<void> {
  try {
    const { notifications } = await collections();
    await notifications.insertOne({
      _id: crypto.randomUUID(),
      id: crypto.randomUUID(),
      user_id: userId,
      type,
      title,
      message: message ?? null,
      complaint_id: complaintId ?? null,
      read: false,
      created_at: new Date(),
    });
  } catch (e) {
    console.error("[notify] failed:", e);
  }
}

/** Generate a new complaint ticket number from the sequence counter. */
export async function nextTicketNo(seq: number): Promise<string> {
  return "RA-" + String(1000 + seq);
}
