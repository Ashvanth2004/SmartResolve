"use client";

import { cn } from "@/lib/format";
import { statusColor, priorityColor, STATUS_LABELS } from "./common";

export function Badge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={statusColor(status)}>{STATUS_LABELS[status] || status}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge className={priorityColor(priority)}>{priority || "MEDIUM"}</Badge>;
}

const ROLE_MAP: Record<string, string> = {
  USER: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
  AGENT: "bg-stone-100 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300",
  MANAGER: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  ADMIN: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
};
const ROLE_LABEL: Record<string, string> = {
  USER: "Customer",
  AGENT: "Agent",
  MANAGER: "Manager",
  ADMIN: "Admin",
};

export function RoleBadge({ role }: { role: string }) {
  return <Badge className={ROLE_MAP[role] || ROLE_MAP.USER}>{ROLE_LABEL[role] || role}</Badge>;
}