/** SLA computation helpers. */
import { collections } from "@/lib/mongodb";

export const SLA_DEFAULTS: Record<string, number> = { CRITICAL: 4, HIGH: 12, MEDIUM: 24, LOW: 72 };

let cache: Record<string, number> | null = null;

export async function getSlaHours(priority: string): Promise<number> {
  if (!cache) {
    try {
      const { sla_rules } = await collections();
      const rows = await sla_rules.find({ is_active: true }).toArray();
      const map: Record<string, number> = {};
      for (const r of rows as any[]) map[String(r.priority)] = Number(r.time_limit_hours);
      cache = map;
    } catch {
      cache = SLA_DEFAULTS;
    }
  }
  return (cache && cache[priority]) || SLA_DEFAULTS[priority] || 24;
}

export function computeSlaDeadline(priority: string, createdAt: Date, hours?: number): Date {
  const h = hours || SLA_DEFAULTS[priority] || 24;
  return new Date(createdAt.getTime() + h * 3600000);
}

export type SlaState = "compliant" | "approaching" | "breached" | "resolved" | "none";

/** Derive the SLA state of a complaint from its deadline + status. */
export function slaStateOf(deadline: Date | null, status: string): SlaState {
  if (status === "RESOLVED" || status === "CLOSED") return "resolved";
  if (!deadline) return status === "NEW" || status === "AI_ANALYZED" ? "none" : "none";
  const now = Date.now();
  const diffMs = deadline.getTime() - now;
  if (diffMs < 0) return "breached";
  const hoursLeft = diffMs / 3600000;
  if (hoursLeft <= 2) return "approaching";
  return "compliant";
}

export function slaRemainingLabel(deadline: Date | null | undefined): { text: string; state: SlaState } {
  if (!deadline) return { text: "—", state: "none" };
  const target = typeof deadline === "string" ? new Date(deadline) : deadline;
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { text: "SLA BREACHED", state: "breached" };
  const mins = Math.floor(diff / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const text = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`;
  return { text, state: h <= 2 ? "approaching" : "compliant" };
}