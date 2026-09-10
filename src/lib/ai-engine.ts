/**
 * ResolveAI — AI classification engine.
 * Uses a real LLM (Gemini / OpenAI) when configured, otherwise a deterministic
 * semantic taxonomy engine so the demo/viva works offline. Output is always
 * treated as a recommendation and validated against the taxonomy.
 */

export type CategoryKey =
  | "tech" | "billing" | "payment" | "account" | "delivery" | "product"
  | "service" | "security" | "infra" | "staff" | "other";

export type AiPrediction = {
  category: CategoryKey;
  categoryName: string;
  subcategory: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  severity: "Critical" | "High" | "Medium" | "Low";
  sentiment: "Very Negative" | "Negative" | "Neutral" | "Positive";
  department: string;
  departmentKey: string;
  confidence: number;
  suggestedResolution: string;
  model: string;
};

export const DEPARTMENTS: Record<CategoryKey, string> = {
  tech: "Technical Support", billing: "Billing & Finance", payment: "Billing & Finance",
  account: "Customer Support", delivery: "Operations", product: "Operations",
  service: "Customer Support", security: "Security", infra: "Technical Support",
  staff: "Customer Support", other: "Customer Support",
};

export interface TaxonomyEntry {
  key: CategoryKey;
  name: string;
  deptKey: string;
  subcategories: string[];
  keywords: string[];
}

export const TAXONOMY: TaxonomyEntry[] = [
  { key: "tech", name: "Technical Support", deptKey: "ts", subcategories: ["Internet Connectivity", "Mobile App", "Hardware", "Software Bug", "Printer", "Feature Request", "Performance"], keywords: ["internet", "connection", "wifi", "network", "disconnect", "slow", "connect", "offline", "app", "software", "crash", "printer", "laptop", "system", "error", "update", "browser", "computer", "load", "scan", "qr", "outage", "website", "server"] },
  { key: "billing", name: "Billing", deptKey: "billing", subcategories: ["Duplicate Charge", "Invoice Dispute", "Billing Error", "Pricing", "Document Access"], keywords: ["bill", "billed", "billing", "invoice", "charge", "charged", "charges", "overcharge", "monthly fee", "subscription cost", "statement", "price", "pricing"] },
  { key: "payment", name: "Payment", deptKey: "billing", subcategories: ["Refund", "Failed Transaction", "Renewal", "Declined"], keywords: ["payment", "paid", "debit", "card", "refund", "money back", "transaction", "deducted", "charged twice", "pay", "repay", "credit", "renewal", "autopay"] },
  { key: "account", name: "Account", deptKey: "cs", subcategories: ["Password Reset", "Account Access", "Profile Update", "Verification", "Account Merge"], keywords: ["password", "login", "reset", "account", "profile", "email", "sign in", "locked", "verify", "verification", "username", "register", "2fa", "authenticate"] },
  { key: "delivery", name: "Delivery", deptKey: "ops", subcategories: ["Lost Shipment", "Late Delivery", "Wrong Item", "Delivery Dispute", "Urgent Delivery"], keywords: ["delivery", "delivered", "package", "parcel", "shipment", "shipping", "tracking", "dispatch", "courier", "arrived", "deliver", "handover"] },
  { key: "product", name: "Product", deptKey: "ops", subcategories: ["Damaged Item", "Quality", "Defective", "Malfunction"], keywords: ["product", "item", "defective", "broken", "damaged", "damage", "quality", "faulty", "battery", "screen", "accessory"] },
];

export const TAXONOMY_2: TaxonomyEntry[] = [
  { key: "service", name: "Service Quality", deptKey: "cs", subcategories: ["Performance", "Notification Issue", "Experience"], keywords: ["service", "quality", "experience", "poor", "satisfaction", "wait", "response time", "down", "performance", "unreliable", "notification"] },
  { key: "security", name: "Security", deptKey: "sec", subcategories: ["Unauthorized Access", "Phishing", "Fraud", "Privacy", "Suspicious Activity"], keywords: ["security", "unauthorized", "unauthorised", "hack", "hacked", "fraud", "phishing", "privacy", "breach", "stolen", "suspicious", "identity", "compromise", "scam"] },
  { key: "infra", name: "Infrastructure", deptKey: "ts", subcategories: ["Outage", "Facilities", "Power", "Access Control"], keywords: ["power", "electricity", "outage", "building", "elevator", "lift", "light", "facility", "facilities", "wifi coverage", "access point", "badge", "door", "washroom", "server room", "infrastructure"] },
  { key: "staff", name: "Staff Behavior", deptKey: "cs", subcategories: ["Staff Conduct", "Unresponsiveness", "Communication"], keywords: ["rude", "staff", "representative", "agent", "behaviour", "behavior", "unprofessional", "unresponsive", "ignored", "unhelpful", "offensive", "hostile"] },
  { key: "other", name: "Other", deptKey: "cs", subcategories: ["General"], keywords: [] },
];

const ALL_TAXONOMY: TaxonomyEntry[] = [...TAXONOMY, ...TAXONOMY_2];

export const SUGGESTIONS: Record<CategoryKey, string> = {
  tech: "Check logs and recent changes, reproduce the issue on a test profile, apply the relevant fix, then verify with the customer.",
  billing: "Pull the account billing history, reconcile the charge against the agreed plan, correct any discrepancy, and confirm the resolution to the customer.",
  payment: "Verify the payment with the gateway, confirm whether the amount was captured, then refund or complete the transaction and inform the customer.",
  account: "Verify the account ownership securely, resolve the access issue, and confirm the fix with the customer.",
  delivery: "Trace the shipment with the carrier, confirm the delivery details, and arrange a replacement, re-delivery, or refund.",
  product: "Check the product batch and warranty, arrange a replacement or refund, and file a claim if necessary.",
  service: "Identify the service bottleneck, apply improvements, and communicate the expected resolution to the customer.",
  security: "Immediately secure the account, revoke active sessions, enable 2FA, and review access logs for further action.",
  infra: "Coordinate with the facilities/infrastructure team, schedule the fix, and provide a clear ETA to those affected.",
  staff: "Review the conversation record, address the staff matter internally, and apologise / follow up with the customer.",
  other: "Review the details, route to the most relevant team, and confirm the next steps with the customer.",
};

const PRIORITY_WORDS: Record<string, string[]> = {
  CRITICAL: ["compromised", "hacked", "breach", "fraud", "stolen", "entire", "all users", "outage", "emergency", "critical", "patient", "urgent medical", "medical"],
  HIGH: ["cannot", "unable", "not working", "blocked", "locked", "urgent", "important", "failed", "failing", "very slow", "never received", "deducted", "twice", "reset"],
  MEDIUM: ["issue", "problem", "slow", "difficult", "damaged", "erroneous", "wrong", "delayed"],
  LOW: ["minor", "suggestion", "request", "feature", "enquiry", "questions", "help understanding", "please", "wish", "would like"],
};

const NEGATIVES = ["very negative", "unacceptable", "furious", "angry", "terrible", "worst", "ridiculous", "shocked", "appalled"];
const MILD_NEGATIVES = ["not", "cannot", "unable", "problem", "issue", "never", "failed", "wrong", "error", "rude", "slow", "disappointed", "frustrated", "broken", "missing"];
const POSITIVES = ["thank", "great", "love", "happy", "positive", "excellent"];

function detectCategory(text: string): { entry: TaxonomyEntry; score: number } {
  let best = ALL_TAXONOMY[ALL_TAXONOMY.length - 1];
  let bestScore = 0;
  for (const entry of ALL_TAXONOMY) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (text.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return { entry: best, score: bestScore };
}

function detectSubcategory(text: string, entry: TaxonomyEntry): string {
  const firstWord = text.split(" ").slice(0, 8).join(" ");
  if (entry.key === "tech") {
    if (firstWord.includes("internet") || firstWord.includes("wifi") || firstWord.includes("network") || firstWord.includes("connection") || firstWord.includes("connect")) return "Internet Connectivity";
    if (firstWord.includes("app") || text.includes("mobile app")) return "Mobile App";
    if (text.includes("printer")) return "Printer";
    if (text.includes("feature") || text.includes("suggestion") || text.includes("would like")) return "Feature Request";
    if (text.includes("slow") || text.includes("performance")) return "Performance";
    return "Software Bug";
  }
  if (entry.key === "billing") {
    if (text.includes("twice") || text.includes("duplicate")) return "Duplicate Charge";
    if (text.includes("invoice")) return "Invoice Dispute";
    return "Billing Error";
  }
  if (entry.key === "payment") {
    if (text.includes("refund") || text.includes("money back")) return "Refund";
    if (text.includes("renewal")) return "Renewal";
    return "Failed Transaction";
  }
  if (entry.key === "security") {
    if (text.includes("phishing") || text.includes("scam")) return "Phishing";
    if (text.includes("privacy") || text.includes("data")) return "Privacy";
    if (text.includes("fraud") || text.includes("stolen")) return "Fraud";
    return "Unauthorized Access";
  }
  if (entry.key === "delivery") {
    if (text.includes("late") || text.includes("stuck") || text.includes("arrived")) return "Late Delivery";
    if (text.includes("lost") || text.includes("not arrived")) return "Lost Shipment";
    if (text.includes("wrong")) return "Wrong Item";
    return "Delivery Dispute";
  }
  if (entry.key === "product") {
    if (text.includes("damage")) return "Damaged Item";
    return "Defective";
  }
  if (entry.key === "account") {
    if (text.includes("password") || text.includes("reset")) return "Password Reset";
    if (text.includes("locked") || text.includes("cannot login") || text.includes("login")) return "Account Access";
    return "Profile Update";
  }
  if (entry.key === "infra") return text.includes("outage") ? "Outage" : "Facilities";
  if (entry.key === "staff") return text.includes("rude") || text.includes("offensive") ? "Staff Conduct" : "Unresponsiveness";
  return entry.subcategories[0];
}

function detectSentiment(text: string): "Very Negative" | "Negative" | "Neutral" | "Positive" {
  const hits = (arr: string[]) => arr.filter((w) => text.includes(w)).length;
  if (hits(NEGATIVES) >= 1) return "Very Negative";
  if (hits(POSITIVES) >= 2) return "Positive";
  if (hits(MILD_NEGATIVES) >= 2) return "Negative";
  if (hits(MILD_NEGATIVES) === 1) return "Negative";
  return "Neutral";
}

function detectSeverity(priority: string, sentiment: string): "Critical" | "High" | "Medium" | "Low" {
  if (priority === "CRITICAL") return "High";
  if (priority === "HIGH") return sentiment === "Very Negative" ? "High" : "Medium";
  return priority === "MEDIUM" ? "Medium" : "Low";
}

function detectPriority(text: string): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  const order: ("CRITICAL" | "HIGH" | "MEDIUM" | "LOW")[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  for (const p of order) {
    if (PRIORITY_WORDS[p].some((w) => text.includes(w))) return p;
  }
  return "MEDIUM";
}

/** Built-in deterministic classification (works offline, no API key). */
export function classifyBuiltin(title: string, description: string): AiPrediction {
  const text = ` ${(title + " " + description).toLowerCase()}`;
  const { entry, score } = detectCategory(text);
  const priority = detectPriority(text);
  const sentiment = detectSentiment(text);
  const severity = detectSeverity(priority, sentiment);
  const confidence = Math.min(96, 58 + score * 9 + (entry.key === "other" ? -5 : 12));
  const sub = detectSubcategory(text, entry);
  return {
    category: entry.key,
    categoryName: entry.name,
    subcategory: sub,
    priority,
    severity,
    sentiment,
    department: DEPARTMENTS[entry.key],
    departmentKey: entry.deptKey,
    confidence: Math.max(22, Math.min(96, Math.round(confidence))),
    suggestedResolution: SUGGESTIONS[entry.key],
    model: "semantic-taxonomy-v1 (built-in)",
  };
}

const ALL_MODELS: Record<string, string> = {
  "technical support": "tech", "billing": "billing", "payment": "payment", "account": "account",
  "delivery": "delivery", "product": "product", "service quality": "service", "security": "security",
  "infrastructure": "infra", "staff behavior": "staff", "other": "other",
};

function normalizeCategoryKey(raw: string): CategoryKey {
  const v = (raw || "").trim().toLowerCase();
  if (ALL_MODELS[v]) return ALL_MODELS[v] as CategoryKey;
  for (const [k, key] of Object.entries(ALL_MODELS)) {
    if (v.includes(k) || k.includes(v)) return key as CategoryKey;
  }
  return "other";
}

/** Best-effort JSON extraction from an LLM text response. */
function parseJsonLoose(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    /* ignore */
  }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0].replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
  return null;
}

async function callGemini(prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || "gemini-2.0-flash"}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } }),
    }
  );
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Gemini request failed (${res.status}): ${errorText}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callOpenAi(prompt: string): Promise<string> {
  const res = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", temperature: 0.1, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`OpenAI request failed (${res.status}): ${errorText}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

const TAXONOMY_PROMPT = (title: string, description: string) =>
  `You classify customer complaints. Given the complaint below, return ONLY valid JSON with keys:
"category" (one of: Technical Support, Billing, Payment, Account, Delivery, Product, Service Quality, Security, Infrastructure, Staff Behavior, Other),
"subcategory" (short phrase),
"priority" (one of: CRITICAL, HIGH, MEDIUM, LOW),
"severity" (one of: Low, Medium, High, Critical),
"sentiment" (one of: Positive, Neutral, Negative, Very Negative),
"department" (one of: Technical Support, Billing & Finance, Customer Support, Operations, Security),
"confidence" (number 0-100),
"suggested_resolution" (concrete step-by-step guidance; do not claim a real-world action already occurred).
Title: ${title}\nDescription: ${description}`;

function fromModelJson(j: any, builtin: AiPrediction): AiPrediction {
  const key = normalizeCategoryKey(j.category || builtin.category);
  const builtinEntry = ALL_TAXONOMY.find((t) => t.key === builtin.category);
  const prio = ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(String(j.priority).toUpperCase())
    ? String(j.priority).toUpperCase() : builtin.priority;
  let sentRaw = String(j.sentiment || builtin.sentiment).toLowerCase();
  const sent = ["positive", "neutral", "negative", "very negative"].includes(sentRaw)
    ? (sentRaw === "very negative" ? "Very Negative" : sentRaw[0].toUpperCase() + sentRaw.slice(1))
    : builtin.sentiment;
  const conf = Math.max(0, Math.min(100, Number(j.confidence)));
  const dept = ["Technical Support", "Billing & Finance", "Customer Support", "Operations", "Security"].includes(String(j.department))
    ? String(j.department) : builtin.department;
  return {
    category: key,
    categoryName: ALL_TAXONOMY.find((t) => t.key === key)?.name || builtinEntry?.name || key,
    subcategory: j.subcategory || builtin.subcategory,
    priority: prio as AiPrediction["priority"],
    severity: (["Low", "Medium", "High", "Critical"].includes(j.severity) ? j.severity : builtin.severity) as AiPrediction["severity"],
    sentiment: sent as AiPrediction["sentiment"],
    department: dept,
    departmentKey: resolveDeptKey(dept) || builtin.departmentKey,
    confidence: Number.isFinite(conf) ? Math.round(conf) : builtin.confidence,
    suggestedResolution: j.suggested_resolution || builtin.suggestedResolution,
    model: "llm-validated",
  };
}

function resolveDeptKey(dept: string): string | null {
  const d = (dept || "").toLowerCase();
  if (d.includes("technical")) return "ts";
  if (d.includes("billing") || d.includes("finance")) return "billing";
  if (d.includes("operation") || d.includes("logistic")) return "ops";
  if (d.includes("security")) return "sec";
  if (d.includes("customer") || d.includes("support")) return "cs";
  return null;
}

function aiEnabled(): boolean {
  return process.env.AI_ENABLED === "true" || process.env.AI_ENABLED === "1";
}

function chooseProvider(): "gemini" | "openai" | "builtin" {
  const pref = (process.env.AI_PROVIDER || "auto").toLowerCase();
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
  if (pref === "gemini") return hasGemini ? "gemini" : "builtin";
  if (pref === "openai") return hasOpenAi ? "openai" : "builtin";
  if (pref === "builtin") return "builtin";
  if (hasGemini) return "gemini";
  if (hasOpenAi) return "openai";
  return "builtin";
}

/** Unified classification entry point: real LLM when configured, else built-in. */
export async function classifyComplaint(title: string, description: string): Promise<AiPrediction> {
  const builtin = classifyBuiltin(title, description);
  if (!aiEnabled()) return builtin;
  const provider = chooseProvider();
  if (provider === "builtin") return builtin;

  let raw = "";
  try {
    const prompt = TAXONOMY_PROMPT(title, description);
    raw = provider === "gemini" ? await callGemini(prompt) : await callOpenAi(prompt);
  } catch (e) {
    console.error("[ai] LLM call failed, using built-in:", e);
    return { ...builtin, model: builtin.model + " (llm-unavailable)" };
  }
  const parsed = parseJsonLoose(raw);
  if (!parsed) return { ...builtin, model: builtin.model + " (llm-parse-failed)" };
  const pred = fromModelJson(parsed, builtin);
  return { ...pred, model: `${provider}·${process.env.GEMINI_MODEL || process.env.OPENAI_MODEL || "llm"}` };
}

/** Generate a concise operational summary of a complaint for agents. */
export async function generateSummary(input: {
  title: string;
  description: string;
  status: string;
  department: string | null;
  priority: string;
}): Promise<string> {
  const builtin =
    `Summary: "${input.title}". Customer issue: ${truncateStr(input.description, 140)}. ` +
    `Current status: ${input.status}. Priority: ${input.priority}. ` +
    `Department: ${input.department || "Unassigned"}. Recommended next step: ${SUGGESTIONS[
      classifyBuiltin(input.title, input.description).category
    ]}`;
  if (!aiEnabled() || chooseProvider() === "builtin") return builtin;
  const provider = chooseProvider();
  const prompt =
    `Summarise this support complaint concisely for an agent. Include: (1) the core issue, (2) key facts, (3) actions already taken, (4) current status, (5) a recommended next step. Keep it under 120 words. Do not claim real-world actions occurred unless listed as taken.\nTitle: ${input.title}\nDescription: ${input.description}`;
  try {
    const raw = provider === "gemini" ? await callGemini(prompt) : await callOpenAi(prompt);
    if (raw) return raw.trim();
  } catch {
    /* fall through */
  }
  return builtin;
}

export function truncateStr(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/** Parses a natural-language query into structured complaint filters. */
export function parseNaturalSearch(query: string): {
  category?: string;
  priority?: string;
  status?: string;
  department?: string;
  sentiment?: string;
  text?: string;
  explanation: string;
} {
  const q = query.toLowerCase();
  const out: { category?: string; priority?: string; status?: string; department?: string; sentiment?: string; text?: string; explanation: string } = { explanation: "" };
  const catMap: [string, string][] = [
    ["billing", "billing"], ["payment", "payment"], ["account", "account"], ["technical", "tech"],
    ["internet", "tech"], ["network", "tech"], ["delivery", "delivery"], ["product", "product"],
    ["security", "security"], ["infrastructure", "infra"], ["staff", "staff"], ["service", "service"],
  ];
  for (const [word, cat] of catMap) {
    if (q.includes(word) && !q.includes(`not ${word}`)) { out.category = cat; break; }
  }
  if (q.includes("critical")) out.priority = "CRITICAL";
  else if (q.includes("high priorit") || q.includes("high-priorit")) out.priority = "HIGH";
  else if (q.includes("low priorit") || q.includes("low-priorit")) out.priority = "LOW";
  else if (q.includes("medium")) out.priority = "MEDIUM";

  if (q.includes("resolved")) out.status = "RESOLVED";
  else if (q.includes("unresolved") || q.includes("open") || q.includes("pending")) out.status = "OPEN";
  else if (q.includes("closed")) out.status = "CLOSED";
  else if (q.includes("escalat")) out.status = "ESCALATED";
  else if (q.includes("in progress") || q.includes("in-progress")) out.status = "IN_PROGRESS";

  const deptMap: [string, string][] = [
    ["billing", "billing"], ["technical", "ts"], ["customer support", "cs"], ["support", "cs"],
    ["operations", "ops"], ["logistics", "ops"], ["security team", "sec"],
  ];
  for (const [word, dept] of deptMap) {
    if (q.includes(word)) { out.department = dept; break; }
  }
  if (q.includes("very negative")) out.sentiment = "Very Negative";
  else if (q.includes("negative")) out.sentiment = "Negative";
  else if (q.includes("positive")) out.sentiment = "Positive";
  else if (q.includes("neutral")) out.sentiment = "Neutral";

  const stop = new Set(["show", "me", "all", "the", "of", "from", "that", "are", "still", "last", "month", "week", "year", "complaints", "complaint", "which", "with", "and", "a", "an", "any"]);
  const used = new Set<string>(["show","me","all","the","of","from","that","are","still","last","month","week","complaints","complaint","which","with","and","open","pending","unresolved"]);
  const words = query.split(/[^a-zA-Z0-9]+/).filter((w) => w && w.length > 2 && !stop.has(w.toLowerCase()) && !used.has(w.toLowerCase()));
  if (words.length) out.text = words.join(" ");

  out.explanation = `Interpreted "${query}" → Filters: ` +
    (out.category ? `category=${out.category} ` : "") +
    (out.priority ? `priority=${out.priority} ` : "") +
    (out.status ? `status=${out.status} ` : "") +
    (out.department ? `department=${out.department} ` : "") +
    (out.sentiment ? `sentiment=${out.sentiment} ` : "") +
    (out.text ? `text="${out.text}" ` : "") +
    (Object.keys(out).filter((k) => k !== "explanation").length === 0 ? "none detected." : "");
  return out;
}

/** Jaccard-style similarity between two text blobs (0..100). */
export function similarity(a: string, b: string): number {
  const token = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const ta = new Set(token(a));
  const tb = new Set(token(b));
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  const union = ta.size + tb.size - inter;
  if (union === 0) return 0;
  return Math.round((inter / union) * 100);
}