import { NextResponse } from "next/server";
import { z } from "zod";
import { collections, ensureMongoDb } from "@/lib/mongodb";
import { audit } from "@/lib/api-helpers";
import { generateToken, tokenExpiresAt, sendVerificationEmail } from "@/lib/email-verify";

const ResendSchema = z.object({
  email: z.string().email(),
});

const MAX_RESENDS_PER_HOUR = 3;

/**
 * POST /api/auth/resend-verification
 * Body: { email: string }
 *
 * Generates a new verification token and sends another email.
 * Rate-limited to MAX_RESENDS_PER_HOUR attempts per hour per email.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = ResendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "A valid email address is required." }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();

    await ensureMongoDb();
    const { users, email_verification_tokens } = await collections();

    // Find the user
    const user = await users.findOne(
      { email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
      { projection: { id: 1, name: 1, email: 1, email_verified: 1 } }
    );

    if (!user) {
      // Return success anyway to prevent email enumeration
      return NextResponse.json({ success: true, message: "If that email exists and is unverified, a new link has been sent." });
    }

    if (user.email_verified) {
      return NextResponse.json({ success: false, error: "This email is already verified. You can sign in now." }, { status: 409 });
    }

    // Rate-limit check — count tokens created in the last hour for this user
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await email_verification_tokens.countDocuments({
      user_id: user.id,
      created_at: { $gte: oneHourAgo },
    });

    if (recentCount >= MAX_RESENDS_PER_HOUR) {
      return NextResponse.json(
        { success: false, error: `Too many verification emails sent. Please wait an hour before trying again.` },
        { status: 429 }
      );
    }

    // Delete any existing tokens for the user
    await email_verification_tokens.deleteMany({ user_id: user.id });

    // Generate a fresh token
    const token = generateToken();
    const expiresAt = tokenExpiresAt();
    const now = new Date();

    await email_verification_tokens.insertOne({
      _id: crypto.randomUUID(),
      token,
      user_id: user.id,
      email,
      expires_at: expiresAt,
      resend_count: recentCount + 1,
      created_at: now,
    });

    // Send the email (console mode if SMTP_HOST not set)
    sendVerificationEmail(email, user.name || email, token).catch((e) =>
      console.error("[resend-verification] sendVerificationEmail failed:", e)
    );

    await audit(null, "EMAIL_VERIFICATION_RESENT", "user", user.id, email,
      `Verification email resent (attempt ${recentCount + 1}).`);

    return NextResponse.json({
      success: true,
      message: "A new verification link has been sent. Please check your inbox (and spam folder).",
    });
  } catch (e) {
    console.error("[resend-verification]", e);
    return NextResponse.json({ success: false, error: "Failed to resend. Please try again." }, { status: 500 });
  }
}
