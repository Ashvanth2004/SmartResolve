"use client";

import { cn } from "@/lib/format";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cn("skeleton-shimmer rounded-md h-4", className)} aria-hidden />;
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4 stagger-children">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface border border-app rounded-xl p-4 card-shine">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-16 mt-2" />
        </div>
      ))}
    </div>
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <span className="animate-float inline-flex">
        <span className="ai-orb" style={{ width: 56, height: 56 }} aria-hidden>
          <span className="ai-orb-core">R</span>
          <span className="ai-orb-ring ai-orb-ring-1" />
          <span className="ai-orb-ring ai-orb-ring-2" />
        </span>
      </span>
      <div className="ai-think-bar progress-shimmer" aria-hidden><span className="ai-think-bar-fill" /></div>
      <div className="ai-wave" aria-hidden><span /><span /><span /><span /><span /></div>
      <p className="text-sm text-muted animate-pulse">{label}</p>
    </div>
  );
}