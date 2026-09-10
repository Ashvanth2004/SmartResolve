"use client";

/** Shared UI constants and badge/colour helpers. */

export const ROLES: Record<string, string> = {
  USER: "Customer",
  AGENT: "Support Agent",
  MANAGER: "Department Manager",
  ADMIN: "Administrator",
};

export const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  AI_ANALYZED: "AI Analysis",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  WAITING: "Waiting",
  ESCALATED: "Escalated",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
};

export const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export function statusColor(s: string): string {
  switch (s) {
    case "RESOLVED":
    case "CLOSED":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
    case "ESCALATED":
      return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400";
    case "IN_PROGRESS":
      return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400";
    case "WAITING":
    case "AI_ANALYZED":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
    case "NEW":
      return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400";
  }
}

export function priorityColor(p: string): string {
  switch (p) {
    case "CRITICAL":
      return "bg-red-600 text-white";
    case "HIGH":
      return "bg-orange-500 text-white";
    case "MEDIUM":
      return "bg-amber-400 text-amber-900 dark:text-amber-100";
    default:
      return "bg-gray-200 text-gray-700 dark:bg-white/15 dark:text-gray-300";
  }
}

export function sentimentColor(s: string): string {
  switch (String(s).toLowerCase()) {
    case "very negative":
      return "#ef4444";
    case "negative":
      return "#f97316";
    case "positive":
      return "#10b981";
    default:
      return "#94a3b8";
  }
}

export function confidenceTone(c: number | null | undefined): { tone: string; msg: string } {
  const v = c || 0;
  if (v >= 70) return { tone: "success", msg: "High confidence" };
  if (v >= 50) return { tone: "warning", msg: "Moderate confidence — review recommended" };
  return { tone: "danger", msg: "AI classification requires human review." };
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8).toUpperCase() : "—";
}