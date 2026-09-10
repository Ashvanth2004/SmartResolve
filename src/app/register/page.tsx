"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useToast } from "@/lib/ui/toast";
import { PageLoader } from "@/lib/ui/skeleton";
import { MailCheck, RefreshCw, ArrowLeft } from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-app bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-red-500/50";

// Simple client-side syntax check for instant UI feedback
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const { status } = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  /** After successful registration — show the "check inbox" screen */
  const [verifyPending, setVerifyPending] = useState<{ email: string; name: string } | null>(null);

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  if (status === "loading") return <PageLoader />;
  if (status === "authenticated") return <PageLoader label="Already signed in — redirecting…" />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const emailSyntaxOk = !form.email || EMAIL_RE.test(form.email);
  const passwordOk = form.password.length >= 6;
  const matchOk = form.password === form.confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordOk || !matchOk) return;
    setBusy(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Registration failed.", "error");
        return;
      }
      // Show the email-check screen instead of auto sign-in
      setVerifyPending({ email: form.email.trim(), name: form.name.trim() });
    } catch {
      showToast("Network error — please try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!verifyPending) return;
    setResendBusy(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verifyPending.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Could not resend. Please try again.", "error");
      } else {
        showToast("Verification email resent! Check your inbox.", "success");
      }
    } catch {
      showToast("Network error — please try again.", "error");
    } finally {
      setResendBusy(false);
    }
  }

  // ── "Check your inbox" screen ──────────────────────────────────────────────
  if (verifyPending) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex items-center gap-2 justify-center">
            <span className="h-9 w-9 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold">R</span>
            <span className="font-bold text-lg text-foreground">ResolveAI</span>
          </div>

          <div className="bg-surface border border-app rounded-xl shadow-sm p-8 space-y-5">
            {/* Animated envelope icon */}
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center animate-bounce-slow">
                <MailCheck size={38} className="text-red-600" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Check your inbox!</h2>
              <p className="text-sm text-muted leading-relaxed">
                We&apos;ve sent a verification link to{" "}
                <span className="font-semibold text-foreground">{verifyPending.email}</span>.
                Click the link to activate your account.
              </p>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-xs text-red-700 dark:text-red-300">
              ⏰ The link expires in <strong>15 minutes</strong>. Check your spam folder too.
            </div>

            <div className="space-y-3 pt-1">
              <button
                onClick={resend}
                disabled={resendBusy}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-app bg-surface text-sm font-medium text-foreground hover:bg-surface-2 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={15} className={resendBusy ? "animate-spin" : ""} />
                {resendBusy ? "Sending…" : "Resend verification email"}
              </button>

              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
              >
                <ArrowLeft size={14} />
                Back to sign in
              </Link>
            </div>
          </div>

          <p className="text-xs text-muted">
            Wrong email?{" "}
            <button
              onClick={() => setVerifyPending(null)}
              className="text-red-600 dark:text-red-400 font-medium hover:underline"
            >
              Start over
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Registration form ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-2 justify-center">
          <span className="h-9 w-9 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold">R</span>
          <span className="font-bold text-lg text-foreground">ResolveAI</span>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Create your account</h2>
          <p className="text-sm text-muted mt-1">Register to submit and track complaints.</p>
        </div>

        <form onSubmit={submit} className="space-y-4 bg-surface border border-app rounded-xl shadow-sm p-5">
          <div>
            <label className="text-xs font-medium text-muted">Full name</label>
            <input required minLength={2} maxLength={80} className={inputCls} value={form.name} onChange={set("name")} placeholder="Your name" autoComplete="name" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Email</label>
            <input
              required type="email" className={inputCls} value={form.email}
              onChange={set("email")} placeholder="you@example.com" autoComplete="email"
            />
            {form.email && !emailSyntaxOk && (
              <p className="text-[11px] text-red-500 mt-1">Please enter a valid email address.</p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Password</label>
            <input required type="password" className={inputCls} value={form.password} onChange={set("password")} placeholder="At least 6 characters" autoComplete="new-password" />
            {form.password && !passwordOk && <p className="text-[11px] text-red-500 mt-1">Password must be at least 6 characters.</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Confirm password</label>
            <input required type="password" className={inputCls} value={form.confirm} onChange={set("confirm")} placeholder="Repeat password" autoComplete="new-password" />
            {form.confirm && !matchOk && <p className="text-[11px] text-red-500 mt-1">Passwords do not match.</p>}
          </div>
          <button
            type="submit"
            disabled={busy || !passwordOk || !matchOk || !emailSyntaxOk}
            className="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-sm text-muted text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-red-600 dark:text-red-400 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
