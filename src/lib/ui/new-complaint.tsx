"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import { useToast } from "./toast";
import { Badge } from "./badge";
import { confidenceTone } from "./common";
import { Plus } from "lucide-react";

type Similar = { id: string; ticket_no: string; title: string; status: string; similarity: number };

const inputCls =
  "w-full rounded-lg border border-app bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-red-500/50";

/** "New complaint" button + modal. Submits to POST /api/complaints (AI classification + duplicate detection). */
export function NewComplaintButton({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [similar, setSimilar] = useState<Similar[]>([]);
  const [result, setResult] = useState<{ ticketNo: string; prediction: any; needsHumanReview: boolean } | null>(null);
  const [form, setForm] = useState({ title: "", description: "", location: "", contactMethod: "", additionalInfo: "" });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const close = () => {
    setOpen(false);
    setForm({ title: "", description: "", location: "", contactMethod: "", additionalInfo: "" });
    setSimilar([]);
    setResult(null);
    setConfirmDuplicate(false);
  };

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, confirmDuplicate: confirmDuplicate || similar.length > 0 }),
      });
      const data = await res.json();
      if (res.status === 409 && data.duplicateWarning) {
        setSimilar(data.similar || []);
        return;
      }
      if (!res.ok) {
        showToast(data.error || "Complaint could not be submitted.", "error");
        return;
      }
      setResult({ ticketNo: data.ticketNo, prediction: data.prediction, needsHumanReview: data.needsHumanReview });
      showToast(`Complaint ${data.ticketNo} submitted`, "success");
      onCreated?.();
      router.refresh();
    } catch {
      showToast("Network error — please try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  const tone = result ? confidenceTone(result.prediction?.confidence) : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
      >
        <Plus size={15} /> New complaint
      </button>

      <Modal
        open={open}
        onClose={close}
        title={result ? "Complaint submitted" : "New complaint"}
        footer={
          result ? (
            <button onClick={close} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium">
              Done
            </button>
          ) : (
            <>
              <button onClick={close} className="px-3 py-1.5 rounded-lg border border-app text-sm text-muted hover:bg-surface-2">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={busy || form.title.trim().length < 5 || form.description.trim().length < 10}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {busy ? "Submitting…" : similar.length > 0 ? "Submit anyway" : "Submit complaint"}
              </button>
            </>
          )
        }
      >
        {result ? (
          <div className="space-y-3 text-sm">
            <p>
              Ticket <span className="font-mono font-bold text-red-600 dark:text-red-400">{result.ticketNo}</span> has been created and
              routed by the AI engine.
            </p>
            <div className="rounded-lg bg-surface-2 border border-app p-3 space-y-1.5">
              <p className="text-xs uppercase tracking-wide text-muted font-semibold">AI classification</p>
              <p><span className="text-muted">Category:</span> <span className="font-medium">{result.prediction?.categoryName}</span></p>
              <p><span className="text-muted">Priority:</span> <span className="font-medium">{result.prediction?.priority}</span></p>
              <p>
                <span className="text-muted">Confidence:</span>{" "}
                <Badge
                  className={
                    tone?.tone === "success"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                      : tone?.tone === "warning"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                        : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                  }
                >
                  {Math.round((result.prediction?.confidence || 0) * 100)}%
                </Badge>
              </p>
              {result.needsHumanReview && (
                <p className="text-amber-600 dark:text-amber-400 text-xs font-medium">Flagged for human review (low confidence).</p>
              )}
              <p className="text-xs text-muted">{result.prediction?.suggestedResolution}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {similar.length > 0 && (
              <div className="rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-500/10 p-3">
                <p className="font-semibold text-amber-700 dark:text-amber-400 text-xs mb-1.5">
                  Possible duplicates found — please review before continuing.
                </p>
                <ul className="space-y-1">
                  {similar.map((s) => (
                    <li key={s.id} className="text-xs text-foreground">
                      <span className="font-mono font-semibold">{s.ticket_no}</span> — {s.title}{" "}
                      <span className="text-muted">({Math.round(s.similarity)}% similar)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted">Title *</label>
              <input className={inputCls} value={form.title} onChange={set("title")} placeholder="Brief summary of the issue" maxLength={200} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted">Description *</label>
              <textarea
                className={inputCls + " min-h-[110px] resize-y"}
                value={form.description}
                onChange={set("description")}
                placeholder="Describe what happened, when it started and what you expected…"
                maxLength={4000}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted">Location</label>
                <input className={inputCls} value={form.location} onChange={set("location")} placeholder="e.g. Mumbai, Andheri East" maxLength={160} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Preferred contact</label>
                <input className={inputCls} value={form.contactMethod} onChange={set("contactMethod")} placeholder="Email / phone" maxLength={40} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted">Additional information</label>
              <textarea
                className={inputCls + " min-h-[60px] resize-y"}
                value={form.additionalInfo}
                onChange={set("additionalInfo")}
                placeholder="Optional — any extra context that may help."
                maxLength={2000}
              />
            </div>
            <p className="text-[11px] text-muted">
              The AI engine will classify the category, priority, sentiment and route it to the right department automatically.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
