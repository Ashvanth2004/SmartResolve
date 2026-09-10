import { NextResponse } from "next/server";
import { z } from "zod";
import { collections, ensureMongoDb } from "@/lib/mongodb";
import { hashPassword } from "@/lib/password";
import { audit } from "@/lib/api-helpers";
import {
  validateEmailFull,
  generateToken,
  tokenExpiresAt,
  sendVerificationEmail,
} from "@/lib/email-verify";

const RegisterSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  departmentId: z.string().uuid().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid name, email and a password of at least 6 characters." },
        { status: 400 }
      );
    }
    const { name, email: rawEmail, password, departmentId } = parsed.data;
    const email = rawEmail.trim().toLowerCase();

    // ── Step 1: Full email validation (syntax + disposable + MX DNS) ──────────
    const emailCheck = await validateEmailFull(email);
    if (!emailCheck.ok) {
      await audit(null, "EMAIL_VERIFICATION_FAILED", "user", undefined, email,
        `Registration blocked: ${emailCheck.error}`);
      return NextResponse.json({ success: false, error: emailCheck.error }, { status: 400 });
    }

    // ── Step 2: Guarantee collections + indexes + demo data exist ─────────────
    await ensureMongoDb();

    const { users, email_verification_tokens } = await collections();

    const existing = await users.countDocuments({
      email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });
    if (existing > 0) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // ── Step 3: Create user with email_verified = false ───────────────────────
    const { hash, salt } = hashPassword(password);
    const id = crypto.randomUUID();
    const now = new Date();
    await users.insertOne({
      _id: id, id, name, email, password_hash: hash, salt,
      role: "USER", department_id: departmentId || null,
      email_verified: false,
      created_at: now, updated_at: now,
    });
    await audit(null, "USER_REGISTERED", "user", id, email, "New account created — verification pending.");

    // ── Step 4: Generate token + send verification email ──────────────────────
    const token = generateToken();
    const expiresAt = tokenExpiresAt();

    // Remove any previous tokens for this user (idempotent resend)
    await email_verification_tokens.deleteMany({ user_id: id });
    await email_verification_tokens.insertOne({
      _id: crypto.randomUUID(),
      token,
      user_id: id,
      email,
      expires_at: expiresAt,
      resend_count: 0,
      created_at: now,
    });

    // Fire-and-forget — don't block the 201 response on email delivery
    sendVerificationEmail(email, name, token).catch((e) =>
      console.error("[register] sendVerificationEmail failed:", e)
    );

    await audit(null, "EMAIL_VERIFICATION_SENT", "user", id, email,
      "Verification email dispatched on registration.");

    return NextResponse.json(
      {
        success: true,
        requiresVerification: true,
        message: "Account created! Please check your email to verify your address before signing in.",
        user: { id, name, email, role: "USER" },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json(
      { success: false, error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}