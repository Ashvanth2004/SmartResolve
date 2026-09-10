"use client";

import { cn } from "@/lib/format";

export function Table({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <table className={cn("min-w-full divide-y divide-gray-200 dark:divide-gray-700", className)}>{children}</table>;
}
export function TableHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <thead className={cn("bg-surface-2", className)}>{children}</thead>;
}
export function TableRow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <tr className={cn("border-b border-app hover:bg-surface-2", className)}>{children}</tr>;
}
export function TableHead({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted", className)}>{children}</th>;
}
export function TableCell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-sm text-foreground", className)}>{children}</td>;
}
export function TableBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <tbody className={cn("", className)}>{children}</tbody>;
}