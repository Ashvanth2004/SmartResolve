"use client";

import { useEffect, useState } from "react";

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning";
};

let toasts: Toast[] = [];
const listeners = new Set<(t: Toast[]) => void>();

function emit() {
  const snapshot = [...toasts];
  listeners.forEach((l) => l(snapshot));
}

function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function addToast(t: Toast) {
  toasts = [...toasts, t];
  emit();
  setTimeout(() => removeToast(t.id), 5000);
}

export function useToast() {
  const showToast = (
    msg: string | (Omit<Toast, "id"> & { id?: string }),
    variant?: Toast["variant"]
  ) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    if (typeof msg === "string") addToast({ id, title: msg, variant: variant || "default" });
    else addToast({ variant: "default", ...msg, id: msg.id || id });
  };
  return { showToast };
}

export function ToastContainer() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const l = (t: Toast[]) => setItems(t);
    listeners.add(l);
    l([...toasts]);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const tone = (v?: Toast["variant"]) =>
    v === "error" ? "border-red-500" : v === "success" ? "border-emerald-500" : v === "warning" ? "border-amber-500" : "border-red-500";

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-3 w-80 max-w-[calc(100vw-2rem)]">
      {items.map((t) => (
        <div key={t.id} className={`bg-surface border border-app border-l-4 ${tone(t.variant)} rounded-lg shadow-lg p-4 fade-in`}>
          <div className="flex items-start gap-2.5">
            <span className={`mt-1.5 h-2 w-2 rounded-full ${tone(t.variant).replace("border-", "bg-")}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{t.title}</p>
              {t.description && <p className="text-xs text-muted mt-0.5">{t.description}</p>}
            </div>
            <button onClick={() => removeToast(t.id)} className="text-muted hover:text-foreground text-xs" aria-label="Dismiss">✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}