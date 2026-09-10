"use client";

import Link from "next/link";
import { StatusBadge, PriorityBadge } from "./badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "./table";
import { PageLoader } from "./skeleton";
import { timeAgo, formatSlaRemaining } from "@/lib/format";

export type ComplaintItem = {
  id: string;
  ticket_no: string;
  title: string;
  status: string;
  priority: string;
  sla_deadline?: string | null;
  created_at: string;
  category_name?: string | null;
  department_name?: string | null;
  customer_name?: string | null;
  agent_name?: string | null;
  sla_state?: string;
};

export function ComplaintTable({ items, showCustomer = false }: { items: ComplaintItem[]; showCustomer?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticket</TableHead>
            <TableHead>Title</TableHead>
            {showCustomer && <TableHead>Customer</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>SLA</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c) => {
            const sla = formatSlaRemaining(c.sla_deadline);
            return (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/complaints/${c.id}`} className="font-mono text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">
                    {c.ticket_no}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[280px]">
                  <Link href={`/complaints/${c.id}`} className="block font-medium hover:text-red-600 dark:hover:text-red-400">
                    <span className="line-clamp-2">{c.title}</span>
                  </Link>
                  {c.category_name && <span className="text-[11px] text-muted">{c.category_name}</span>}
                </TableCell>
                {showCustomer && <TableCell className="text-xs">{c.customer_name || "—"}</TableCell>}
                <TableCell><StatusBadge status={c.status} /></TableCell>
                <TableCell><PriorityBadge priority={c.priority} /></TableCell>
                <TableCell className="text-xs">
                  <span
                    className={
                      sla.state === "breach"
                        ? "text-red-600 dark:text-red-400 font-semibold"
                        : sla.state === "warn"
                          ? "text-amber-600 dark:text-amber-400 font-semibold"
                          : "text-muted"
                    }
                  >
                    {c.status === "RESOLVED" || c.status === "CLOSED" ? "—" : sla.text}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted whitespace-nowrap">{timeAgo(c.created_at)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-12 w-12 rounded-xl bg-surface-2 flex items-center justify-center text-2xl mb-3">🗂️</div>
      <p className="font-semibold text-foreground">{title}</p>
      {hint && <p className="text-sm text-muted mt-1 max-w-sm">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <p className="font-semibold text-red-600 dark:text-red-400">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium">
          Try again
        </button>
      )}
    </div>
  );
}

export { PageLoader };
