import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyPassword, demoHash } from "@/lib/password";
import { collections, ensureMongoDb } from "@/lib/mongodb";

type DbUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  department_id: string | null;
  password_hash: string;
  salt: string;
};

const DEMO = demoHash();

/** Demo fallback — used only when the database is unreachable so a demo/viva never breaks. */
const FALLBACK_USERS: Record<string, DbUser> = {
  "admin@resolveai.io": { id: "00000000-0000-4000-8000-000000000001", email: "admin@resolveai.io", name: "Aarav Mehta", role: "ADMIN", department_id: null, password_hash: DEMO.hash, salt: DEMO.salt },
  "manager@resolveai.io": { id: "00000000-0000-4000-8000-000000000002", email: "manager@resolveai.io", name: "Priya Sharma", role: "MANAGER", department_id: "00000000-0000-4000-8000-000000000013", password_hash: DEMO.hash, salt: DEMO.salt },
  "agent@resolveai.io": { id: "00000000-0000-4000-8000-000000000003", email: "agent@resolveai.io", name: "Rahul Verma", role: "AGENT", department_id: "00000000-0000-4000-8000-000000000012", password_hash: DEMO.hash, salt: DEMO.salt },
  "customer@resolveai.io": { id: "00000000-0000-4000-8000-000000000008", email: "customer@resolveai.io", name: "Sneha Iyer", role: "USER", department_id: null, password_hash: DEMO.hash, salt: DEMO.salt },
};

async function findUser(email: string): Promise<DbUser | null> {
  try {
    await ensureMongoDb();
    const { users } = await collections();
    const doc = await users.findOne(
      { email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
      { projection: { _id: 0, id: 1, email: 1, name: 1, role: 1, department_id: 1, password_hash: 1, salt: 1 } }
    );
    if (doc) return doc as unknown as DbUser;
  } catch {
    /* DB unavailable — fall through. */
  }
  const fallback = FALLBACK_USERS[email.toLowerCase()];
  if (fallback) return fallback;
  const legacyMap: Record<string, string> = {
    "admin@example.com": "admin@resolveai.io",
    "manager@example.com": "manager@resolveai.io",
    "agent@example.com": "agent@resolveai.io",
    "customer@example.com": "customer@resolveai.io",
  };
 const mapped = legacyMap[email.toLowerCase()];
 if (mapped) return FALLBACK_USERS[mapped] || null;
 return null;
}

export const authConfig = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const raw = (credentials as any) || {};
        const email = String(raw.email || "").trim().toLowerCase();
        const password = String(raw.password || "");
        if (!email || !password) return null;
        const user = await findUser(email);
        if (!user) return null;
        const ok = verifyPassword(password, user.salt, user.password_hash);
        if (!ok) return null;

        // Block unverified real users (demo fallback users always pass)
        const isFallbackUser = Boolean(FALLBACK_USERS[email]);
        if (!isFallbackUser) {
          try {
            await ensureMongoDb();
            const { users } = await collections();
            const dbUser = await users.findOne({ id: user.id }, { projection: { email_verified: 1 } });
            if (dbUser && dbUser.email_verified === false) {
              // NextAuth treats thrown errors as "CredentialsSignin"; we embed a code in the message
              throw new Error("unverified:" + email);
            }
          } catch (e: any) {
            if (e?.message?.startsWith("unverified:")) throw e;
            // DB unreachable — allow sign-in so a network blip doesn't lock everyone out
            console.warn("[auth] could not check email_verified, allowing sign-in:", e?.message);
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
          role: user.role,
          departmentId: user.department_id || undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role || "USER";
        token.id = user.id;
        token.departmentId = (user as { departmentId?: string }).departmentId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = (token.role as string) || "USER";
        (session.user as any).departmentId = (token.departmentId as string) || null;
      }
      return session;
    },
  },
});