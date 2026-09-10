import { MongoClient, type Db, type Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongo-indexes";
import { seedDemoData } from "@/lib/mongo-seed";
import { createMemoryDb, type MemoryDb } from "@/lib/mockdb";

/**
 * MongoDB Atlas data layer (replaces PostgreSQL).
 * Documents intentionally keep the same snake_case field names the SQL
 * schema used, plus `id` (mirrored to `_id`), so every API response shape
 * and UI component keeps working unchanged.
 *
 * DEMO MODE: when APP_DB=mock (or MONGODB_URI is empty) all collections are
 * served from an in-process, in-memory store seeded with the same demo data —
 * the whole app then runs with ZERO database / network dependency.
 */

const uri = process.env.MONGODB_URI || "";
const dbName = process.env.MONGODB_DB || "smart_resolve";
const memoryMode = process.env.APP_DB?.trim().toLowerCase() === "mock" || !uri;

declare global {
  // eslint-disable-next-line no-var
  var __mongoClient: MongoClient | undefined;
  // eslint-disable-next-line no-var
  var __resolveaiMemoryDb: MemoryDb | undefined;
}

function getMemoryDb(): MemoryDb {
  if (!globalThis.__resolveaiMemoryDb) {
    globalThis.__resolveaiMemoryDb = createMemoryDb();
  }
  return globalThis.__resolveaiMemoryDb;
}

export async function getDb(): Promise<Db> {
  if (memoryMode) return getMemoryDb() as unknown as Db;
  if (!uri) throw new Error("MONGODB_URI is not configured in .env");
  let client = globalThis.__mongoClient;
  if (!client) {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      retryReads: true,
      retryWrites: true,
      maxPoolSize: 10,
      appName: "SmartResolve",
    });
    try {
      await client.connect();
      globalThis.__mongoClient = client;
    } catch (err) {
      globalThis.__mongoClient = undefined;
      throw err;
    }
  }
  return client.db(dbName);
}

export type Collections = {
  users: Collection<any>;
  departments: Collection<any>;
  categories: Collection<any>;
  complaints: Collection<any>;
  complaint_classifications: Collection<any>;
  complaint_messages: Collection<any>;
  complaint_attachments: Collection<any>;
  complaint_events: Collection<any>;
  sla_rules: Collection<any>;
  notifications: Collection<any>;
  feedback: Collection<any>;
  ai_feedback: Collection<any>;
  audit_logs: Collection<any>;
  escalations: Collection<any>;
  counters: Collection<any>;
  email_verification_tokens: Collection<any>;
};

export const COLLECTION_NAMES = [
  "users", "departments", "categories", "complaints", "complaint_classifications",
  "complaint_messages", "complaint_attachments", "complaint_events", "sla_rules",
  "notifications", "feedback", "ai_feedback", "audit_logs", "escalations", "counters",
  "email_verification_tokens",
] as const;

export async function collections(): Promise<Collections> {
  const db = await getDb();
  return {
    users: db.collection("users") as unknown as Collection<any>,
    departments: db.collection("departments") as unknown as Collection<any>,
    categories: db.collection("categories") as unknown as Collection<any>,
    complaints: db.collection("complaints") as unknown as Collection<any>,
    complaint_classifications: db.collection("complaint_classifications") as unknown as Collection<any>,
    complaint_messages: db.collection("complaint_messages") as unknown as Collection<any>,
    complaint_attachments: db.collection("complaint_attachments") as unknown as Collection<any>,
    complaint_events: db.collection("complaint_events") as unknown as Collection<any>,
    sla_rules: db.collection("sla_rules") as unknown as Collection<any>,
    notifications: db.collection("notifications") as unknown as Collection<any>,
    feedback: db.collection("feedback") as unknown as Collection<any>,
    ai_feedback: db.collection("ai_feedback") as unknown as Collection<any>,
    audit_logs: db.collection("audit_logs") as unknown as Collection<any>,
    escalations: db.collection("escalations") as unknown as Collection<any>,
    counters: db.collection("counters") as unknown as Collection<any>,
    email_verification_tokens: db.collection("email_verification_tokens") as unknown as Collection<any>,
  };
}

/** Atomic sequence counter (used for complaint `seq` + `ticket_no`). */
export async function nextSeq(name: string): Promise<number> {
  const { counters } = await collections();
  const res = await counters.findOneAndUpdate(
    { _id: name },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  return Number(res?.value ?? 1);
}

let ensured = false;
let ensurePromise: Promise<void> | null = null;

/** Idempotently guarantee indexes + demo data exist before running queries. */
export async function ensureMongoDb(): Promise<void> {
  if (ensured) return;
  if (!ensurePromise) {
    ensurePromise = doEnsure().catch((e) => {
      ensurePromise = null; // allow a retry on the next request
      throw e;
    });
  }
  return ensurePromise;
}

async function doEnsure(): Promise<void> {
  const cols = await collections();
  await ensureIndexes(cols);

  if (memoryMode) {
    const userCount = await cols.users.countDocuments({});
    const complaintCount = await cols.complaints.countDocuments({});
    if (userCount === 0 && complaintCount === 0) {
      await seedDemoData(cols);
    }
    ensured = true;
    console.log(
      `[ResolveAI] demo (in-memory) DB ready — ${await cols.users.countDocuments({})} users, ${await cols.complaints.countDocuments({})} complaints`
    );
    return;
  }

  const userCount = await cols.users.countDocuments({});
  const complaintCount = await cols.complaints.countDocuments({});
  const hasDemoAdmin = (await cols.users.countDocuments({ email: "admin@resolveai.io" })) > 0;
  // Seed when empty — or when a previous demo seed was interrupted partway.
  const needsSeed = userCount === 0 || (complaintCount === 0 && hasDemoAdmin);

  if (needsSeed) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await seedDemoData(cols);
        break;
      } catch (e: any) {
        if (attempt === 3) throw e;
        console.error(`[ResolveAI] seed attempt ${attempt} failed (${e?.message}), cleaning and retrying…`);
        // Remove partial seed data so the retry starts clean.
        for (const name of COLLECTION_NAMES) {
          await (cols as any)[name].deleteMany({});
        }
        await new Promise((r) => setTimeout(r, 2500 * attempt));
      }
    }
  }
  ensured = true;
  console.log("[ResolveAI] MongoDB ready (collections, indexes and demo data ensured)");
}
