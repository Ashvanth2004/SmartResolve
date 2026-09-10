"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Loader2, RefreshCw, MailCheck } from "lucide-react";
import { useToast } from "@/lib/ui/toast";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Loader2 size={24} className="animate-spin text-red-600" />}>
      <VerifyEmailPageContent />
    </Suspense>
  );
}

type Status = "loading" | "success" | "expired" | "invalid" | "server" | "missing";

const STATUS_CONFIG: Record<
  Exclude<Status, "loading">,
  { icon: React.ReactNode; title: string; desc: string; color: string }
> = {
  success: {
    icon: <CheckCircle size={48} className="text-emerald-500" />,
    title: "Email verified!",
    desc: "Your email address has been confirmed. You can now sign in to your account.",
    color: "emerald",
  },
  expired: {
    icon: <XCircle size={48} className="text-amber-500" />,
    title: "Link expired",
    desc: "This verification link has expired (links are valid for 15 minutes). Request a new one below.",
    color: "amber",
  },
  invalid: {
    icon: <XCircle size={48} className="text-red-500" />,
    title: "Invalid link",
    desc: "This verification link is invalid or has already been used. Request a new one below.",
    color: "red",
  },
  missing: {
    icon: <XCircle size={48} className="text-red-500" />,
    title: "No token provided",
    desc: "The verification link is incomplete. Please use the link sent to your email.",
    color: "red",
  },
  server: {
    icon: <XCircle size={48} className="text-red-500" />,
    title: "Something went wrong",
    desc: "A server error occurred during verification. Please try again or request a new link.",
    color: "red",
  },
};

function VerifyEmailPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();

  const errorParam = searchParams.get("error") as Status | null;
  const emailParam = searchParams.get("email") || "";

  // The page is shown either:
  //  (a) when redirected from the API with ?error=xxx  → show error UI
  //  (b) with no params at all → show a generic "verify your email" info page
  const [status, setStatus] = useState<Status>(errorParam || "loading");
  const [resendEmail, setResendEmail] = useState(emailParam);
  const [resendBusy, setResendBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    // If no error param and no token param, page is just informational
    if (!errorParam) {
      setStatus("loading");
      // Give a small delay for redirect from API route to complete
      const t = setTimeout(() => setStatus("missing"), 2000);
      return () => clearTimeout(t);
    }
    setStatus(errorParam);
  }, [errorParam]);

  // Countdown for resend cooldown
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function resend() {
    if (!resendEmail) {
      showToast("Please enter your email address below.", "warning");
      return;
    }
    setResendBusy(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Could not resend. Try again later.", "error");
      } else {
        showToast("New verification link sent! Check your inbox.", "success");
        setCountdown(60); // 60-second cooldown before next resend
      }
    } catch {
      showToast("Network error — please try again.", "error");
    } finally {
      setResendBusy(false);
    }
  }

  // Loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 size={40} className="animate-spin text-red-600 mx-auto" />
          <p className="text-muted text-sm">Verifying your email…</p>
        </div>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[status];
  const isError = status !== "success";

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center">
          <span className="h-9 w-9 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold">R</span>
          <span className="font-bold text-lg text-foreground">ResolveAI</span>
        </div>

        <div className="bg-surface border border-app rounded-xl shadow-sm p-8 space-y-6">
          {/* Icon */}
          <div className="flex justify-center">{cfg.icon}</div>

          {/* Title + description */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{cfg.title}</h1>
            <p className="text-sm text-muted leading-relaxed">{cfg.desc}</p>
          </div>

          {/* Success CTA */}
          {!isError && (
            <button
              onClick={() => router.push("/login?verified=1")}
              className="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              Sign in to my account
            </button>
          )}

          {/* Error — resend form */}
          {isError && (
            <div className="space-y-3">
              <div className="text-left">
                <label className="text-xs font-medium text-muted">Your email address</label>
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-lg border border-app bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>
              <button
                onClick={resend}
                disabled={resendBusy || countdown > 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={15} className={resendBusy ? "animate-spin" : ""} />
                {countdown > 0
                  ? `Resend again in ${countdown}s`
                  : resendBusy
                  ? "Sending…"
                  : "Send new verification link"}
              </button>
            </div>
          )}

          {/* Info tip */}
          {isError && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-left">
              <MailCheck size={16} className="text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300">
                New links expire in 15 minutes. Check your spam/junk folder if you don&apos;t see the email.
              </p>
            </div>
          )}

          <Link
            href="/login"
            className="block text-sm text-muted hover:text-foreground transition-colors"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
