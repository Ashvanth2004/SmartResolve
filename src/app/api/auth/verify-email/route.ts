import { NextResponse } from "next/server";
import { collections, ensureMongoDb } from "@/lib/mongodb";
import { audit } from "@/lib/api-helpers";

/**
 * GET /api/auth/verify-email?token=<hex-token>
 *
 * Validates the token, marks the user's email as verified, deletes the token,
 * then redirects to /login?verified=1.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/verify-email?error=missing`);
  }

  try {
    await ensureMongoDb();
    const { email_verification_tokens, users } = await collections();

    const record = await email_verification_tokens.findOne({ token });

    if (!record) {
      return NextResponse.redirect(`${baseUrl}/verify-email?error=invalid`);
    }

    // Check expiry (belt-and-suspenders — MongoDB TTL may not have fired yet)
    if (new Date() > new Date(record.expires_at)) {
      await email_verification_tokens.deleteOne({ token });
      await audit(null, "EMAIL_VERIFICATION_FAILED", "user", record.user_id, record.email,
        "Token expired on verification attempt.");
      return NextResponse.redirect(`${baseUrl}/verify-email?error=expired&email=${encodeURIComponent(record.email)}`);
    }

    // Mark email as verified
    await users.updateOne(
      { id: record.user_id },
      { $set: { email_verified: true, updated_at: new Date() } }
    );

    // Delete the consumed token
    await email_verification_tokens.deleteOne({ token });

    await audit(null, "EMAIL_VERIFICATION_SUCCESS", "user", record.user_id, record.email,
      "Email address successfully verified.");

    return NextResponse.redirect(`${baseUrl}/login?verified=1`);
  } catch (e) {
    console.error("[verify-email]", e);
    return NextResponse.redirect(`${baseUrl}/verify-email?error=server`);
  }
}
