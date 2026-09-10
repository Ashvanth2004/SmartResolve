"use client";

import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface border border-app rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto fade-in">
        <div className="flex items-center justify-between border-b border-app px-4 py-3">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close"></button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="border-t border-app px-4 py-3 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}