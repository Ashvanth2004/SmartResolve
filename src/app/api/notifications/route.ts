import { NextResponse } from "next/server";
import { collections, ensureMongoDb } from "@/lib/mongodb";
import { getSession, err } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/notifications — the signed-in user's notification centre feed. */
export async function GET() {
  const user = await getSession();
  if (!user) return err("Authentication required. Please sign in.", 401);
  try {
    await ensureMongoDb();
    const { notifications, complaints } = await collections();
    const notifs = await notifications.aggregate([
      { $match: { user_id: user.id } },
      { $sort: { created_at: -1 as const } },
      { $limit: 60 },
      { $lookup: { from: "complaints", localField: "complaint_id", foreignField: "id", as: "_c" } },
      {
        $addFields: {
          ticket_no: { $arrayElemAt: ["$_c.ticket_no", 0] },
          complaint_title: { $arrayElemAt: ["$_c.title", 0] },
        },
      },
      { $unset: "_c" },
    ]).toArray();
    return NextResponse.json({ success: true, notifs });
  } catch (e) {
    console.error("[notifications:GET]", e);
    return err("Unable to load notifications. Please try again.", 500);
  }
}

/** POST /api/notifications — mark read. Body: { id } for one notification or { all: true } for all. */
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return err("Authentication required. Please sign in.", 401);
  try {
    await ensureMongoDb();
    const body = await request.json().catch(() => ({}));
    const { notifications } = await collections();
    if (body?.all) {
      await notifications.updateMany({ user_id: user.id }, { $set: { read: true } });
    } else if (body?.id) {
      await notifications.updateOne({ id: String(body.id), user_id: user.id }, { $set: { read: true } });
    } else {
      return err("Nothing to mark as read.", 400);
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[notifications:POST]", e);
    return err("Unable to update notifications. Please try again.", 500);
  }
}
