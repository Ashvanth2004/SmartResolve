/**
 * email-verify.ts
 * ----------------
 * Email validation + verification token helpers.
 *
 * Three layers of validation:
 *  1. Syntax  – RFC-5321-lite regex
 *  2. Domain  – live DNS MX record lookup (Node built-in dns/promises)
 *  3. Disposable – blocklist of common temp-email providers
 *
 * Email sending uses Nodemailer when SMTP_HOST is configured, otherwise
 * prints the verification link to the server console (ideal for local dev).
 */

import { randomBytes } from "crypto";
import { promises as dns } from "dns";

// ---------------------------------------------------------------------------
// 1. Syntax validation
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export function validateEmailSyntax(email: string): { ok: boolean; error?: string } {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { ok: false, error: "Email is required." };
  if (trimmed.length > 320) return { ok: false, error: "Email address is too long." };
  if (!EMAIL_REGEX.test(trimmed)) return { ok: false, error: "Email address format is invalid." };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 2. Disposable / temporary email domain blocklist
// ---------------------------------------------------------------------------

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "guerrillamail.biz", "guerrillamail.de", "guerrillamail.info", "guerrillamailblock.com",
  "grr.la", "spam4.me", "yopmail.com", "yopmail.fr", "cool.fr.nf", "jetable.fr.nf",
  "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr", "courriel.fr.nf",
  "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf", "trashmail.at",
  "trashmail.com", "trashmail.io", "trashmail.me", "trashmail.net", "trashmail.org",
  "trashmail.xyz", "dispostable.com", "mailnull.com", "spamgourmet.com",
  "tempr.email", "temp-mail.org", "tempmail.com", "tempmail.net", "tempmail.ninja",
  "throwam.com", "throwam.net", "throwam.org", "getairmail.com", "filzmail.com",
  "sharklasers.com", "guerrillamailblock.com", "spam.la", "suremail.info",
  "maildrop.cc", "mailnesia.com", "mailnew.com", "spambog.com", "spambog.de",
  "spambog.ru", "discard.email", "crap.handcrafted.jp", "junk1.tk", "spam.su",
  "mailmetrash.com", "byom.de", "sogetthis.com", "spamherelots.com",
  "fakeinbox.com", "fakemail.net", "fake-mail.net", "dispostable.com",
  "throwam.com", "spambox.us",
]);

export function isDisposable(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] || "";
  return DISPOSABLE_DOMAINS.has(domain);
}

// ---------------------------------------------------------------------------
// 3. DNS MX record check
// ---------------------------------------------------------------------------

export async function checkEmailDomain(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const domain = email.trim().toLowerCase().split("@")[1];
    if (!domain) return { ok: false, error: "Invalid email domain." };
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) {
      return { ok: false, error: `Domain "${domain}" does not accept email (no MX records).` };
    }
    return { ok: true };
  } catch {
    const domain = email.trim().toLowerCase().split("@")[1] || "unknown";
    // Offline / network-restricted environments (local demo, viva) won't have
    // DNS access. In non-production, log and allow instead of blocking signup.
    if (process.env.APP_ENV !== "production") {
      console.warn(`[email-verify] MX lookup failed for "${domain}" — allowing (demo mode).`);
      return { ok: true };
    }
    // ENOTFOUND, ENODATA → domain doesn't exist or has no MX
    return { ok: false, error: `Domain "${domain}" could not be reached. Please use a real email address.` };
  }
}

// ---------------------------------------------------------------------------
// 4. Full composite validation (syntax + disposable + MX)
// ---------------------------------------------------------------------------

export async function validateEmailFull(email: string): Promise<{ ok: boolean; error?: string }> {
  const syntax = validateEmailSyntax(email);
  if (!syntax.ok) return syntax;

  if (isDisposable(email)) {
    return { ok: false, error: "Temporary or disposable email addresses are not allowed." };
  }

  const mx = await checkEmailDomain(email);
  if (!mx.ok) return mx;

  return { ok: true };
}

// ---------------------------------------------------------------------------
// 5. Token generation
// ---------------------------------------------------------------------------

/** Expiry: 15 minutes */
export const TOKEN_TTL_MS = 15 * 60 * 1000;

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function tokenExpiresAt(): Date {
  return new Date(Date.now() + TOKEN_TTL_MS);
}

// ---------------------------------------------------------------------------
// 6. Email sending (Nodemailer when configured, console otherwise)
// ---------------------------------------------------------------------------

function buildVerificationEmailHtml(name: string, verifyUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px 40px;text-align:center;">
          <div style="display:inline-flex;align-items:center;gap:10px;">
            <div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.2);display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:#fff;">R</div>
            <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">ResolveAI</span>
          </div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Verify your email address</h1>
          <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">Hi ${name}, thanks for joining ResolveAI! Click the button below to verify your email and activate your account.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 36px;border-radius:8px;letter-spacing:0.1px;">
              ✅ Verify my email
            </a>
          </div>
          <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;text-align:center;">This link expires in <strong>15 minutes</strong>.</p>
          <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">If you didn't create an account, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #f0f0f0;margin:28px 0 20px;">
          <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;">If the button doesn't work, paste this link into your browser:<br>
            <a href="${verifyUrl}" style="color:#6366f1;word-break:break-all;">${verifyUrl}</a>
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:16px 40px;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">© 2026 ResolveAI · SmartResolve. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

  const smtpHost = process.env.SMTP_HOST?.trim();

  if (!smtpHost) {
    // Console mode — print link to terminal for local dev / demo
    console.log("\n" + "─".repeat(70));
    console.log("📧  [ResolveAI] Email Verification (CONSOLE MODE)");
    console.log("─".repeat(70));
    console.log(`   To      : ${email}  (${name})`);
    console.log(`   Expires : 15 minutes from now`);
    console.log(`   Link    : ${verifyUrl}`);
    console.log("─".repeat(70) + "\n");
    return;
  }

  // Real SMTP via Nodemailer
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"ResolveAI" <no-reply@resolveai.io>`,
    to: `"${name}" <${email}>`,
    subject: "Verify your ResolveAI email address",
    html: buildVerificationEmailHtml(name, verifyUrl),
    text: `Hi ${name},\n\nVerify your ResolveAI email address by visiting:\n${verifyUrl}\n\nThis link expires in 15 minutes.\n\nIf you didn't sign up, ignore this email.`,
  });
}
