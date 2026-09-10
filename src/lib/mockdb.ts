/**
 * mockdb.ts — In-memory MongoDB-compatible data layer.
 *
 * Implements the *subset* of the MongoDB Collection API and aggregation
 * pipeline that ResolveAI actually uses, so the entire application runs
 * locally with ZERO database / network dependency (demo mode).
 *
 * It intentionally mirrors MongoDB semantics (filter operators, $group
 * accumulators, $lookup joins, …) but keeps all data in process memory.
 */

type Doc = Record<string, any>;
type Filter = Record<string, any>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getByPath(doc: Doc, path: string): any {
  if (path === "$") return doc;
  const keys = path.split(".");
  let cur: any = doc;
  for (let i = 0; i < keys.length; i++) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      // MongoDB dot-path semantics: descending into an array maps the
      // remaining sub-path over every element and yields an array of values
      // (e.g. "$_cat.name" over a $lookup result → ["Technical Support"]).
      const sub = keys.slice(i).join(".");
      if (!sub) return cur;
      const mapped = cur.map((item) => getByPath(item, sub)).filter((v) => v !== undefined);
      return mapped;
    }
    cur = cur[keys[i]];
  }
  return cur;
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return a.source === b.source && a.flags === b.flags;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

function compareValues(a: any, b: any): number {
  if (a === b) return 0;
  if (a == null) return b == null ? 0 : -1;
  if (b == null) return 1;
  const na = a instanceof Date ? a.getTime() : a;
  const nb = b instanceof Date ? b.getTime() : b;
  if (typeof na === "number" && typeof nb === "number") return na - nb;
  if (typeof na === "boolean" && typeof nb === "boolean") return na === nb ? 0 : na ? 1 : -1;
  const sa = String(na), sb = String(nb);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function arrayContains(haystack: any[], needle: any): boolean {
  return haystack.some((x) => deepEqual(x, needle));
}

/** Mongo `cmp` semantics for an operator applied to a document field value. */
function matchesOperator(value: any, op: string, arg: any, doc: Doc): boolean {
  switch (op) {
    case "$eq": return deepEqual(value, arg);
    case "$ne": return !deepEqual(value, arg);
    case "$gt": return value != null && compareValues(value, arg) > 0;
    case "$gte": return value != null && compareValues(value, arg) >= 0;
    case "$lt": return value != null && compareValues(value, arg) < 0;
    case "$lte": return value != null && compareValues(value, arg) <= 0;
    case "$in": {
      const arr = Array.isArray(arg) ? arg : [arg];
      if (value == null) return false;
      if (Array.isArray(value)) return value.some((v) => arrayContains(arr, v));
      return arrayContains(arr, value);
    }
    case "$nin":
      return !matchesOperator(value, "$in", arg, doc);
    case "$exists": {
      const present = value !== undefined;
      return Boolean(arg) === present;
    }
    case "$regex": {
      const rx = arg instanceof RegExp ? arg : new RegExp(String(arg));
      return value != null && rx.test(String(value));
    }
    default:
      // Unknown operator object — treat as deep-equality against the whole object.
      return deepEqual(value, { [op]: arg });
  }
}

/**
 * MongoDB-style filter matching.
 * Supports: field equality (incl. RegExp), $eq/$ne/$gt/$gte/$lt/$lte/$in/$nin/
 * $regex/$exists, $or/$and/$not and the app-specific $expr (raw boolean
 * expression over fields).
 */
export function matchFilter(doc: Doc, filter: Filter): boolean {
  if (filter == null || Object.keys(filter).length === 0) return true;
  for (const [key, cond] of Object.entries(filter)) {
    if (key === "$and") {
      const arr = Array.isArray(cond) ? cond : [cond];
      if (!arr.every((f: Filter) => matchFilter(doc, f))) return false;
      continue;
    }
    if (key === "$or") {
      const arr = Array.isArray(cond) ? cond : [cond];
      if (!arr.some((f: Filter) => matchFilter(doc, f))) return false;
      continue;
    }
    if (key === "$nor") {
      const arr = Array.isArray(cond) ? cond : [cond];
      if (arr.some((f: Filter) => matchFilter(doc, f))) return false;
      continue;
    }
    if (key === "$not") {
      if (matchFilter(doc, typeof cond === "object" && !Array.isArray(cond) ? cond : { $and: cond })) return false;
      continue;
    }
    if (key === "$expr") {
      if (!evalExpr(cond, doc)) return false;
      continue;
    }

    const value = getByPath(doc, key);
    if (cond instanceof RegExp) {
      if (value == null || !cond.test(String(value))) return false;
      continue;
    }
    if (cond !== null && typeof cond === "object" && !Array.isArray(cond) && !(cond instanceof Date)) {
      // Operator expression ({ field: { $gte: …, $lt: … } }).
      const isOperatorExpr = Object.keys(cond).every(
        (k) => k.startsWith("$")
      );
      if (isOperatorExpr) {
        const ops = Object.entries(cond);
        for (const [op, arg] of ops) {
          if (!matchesOperator(value, op, arg, doc)) return false;
        }
        continue;
      }
      // Nested document equality.
      if (!deepEqual(value, cond)) return false;
      continue;
    }
    // Scalar / Date / array equality with array-containment semantics.
    if (Array.isArray(value) && value.length > 0 && !Array.isArray(cond)) {
      if (!value.some((v) => deepEqual(v, cond))) return false;
    } else if (!deepEqual(value, cond)) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Aggregation expression evaluator
// ---------------------------------------------------------------------------

/** Evaluate an aggregation expression against a document. */
export function evalExpr(expr: any, doc: Doc): any {
  if (typeof expr === "string") {
    if (expr.startsWith("$")) return getByPath(doc, expr.slice(1));
    return expr;
  }
  if (expr === null || typeof expr !== "object") return expr;
  if (Array.isArray(expr)) return expr.map((e) => evalExpr(e, doc));
  if (expr instanceof Date || expr instanceof RegExp) return expr;

  const [op, arg] = Object.entries(expr)[0] as [string, any];
  switch (op) {
    case "$arrayElemAt": {
      const [arr, idx] = evalExpr(arg, doc);
      const i = Array.isArray(arr) ? Number(idx || 0) : -1;
      return i >= 0 && i < arr.length ? arr[i] : undefined;
    }
    case "$ifNull": {
      const [primary, fallback] = arg;
      const v = evalExpr(primary, doc);
      return v === null || v === undefined ? evalExpr(fallback, doc) : v;
    }
    case "$cond": {
      const [ifE, thenE, elseE] = arg;
      return evalExpr(ifE, doc) ? evalExpr(thenE, doc) : evalExpr(elseE, doc);
    }
    case "$switch": {
      const { branches, default: def } = arg;
      for (const b of branches) {
        if (evalExpr(b.case, doc)) return evalExpr(b.then, doc);
      }
      return def !== undefined ? evalExpr(def, doc) : null;
    }
    case "$eq": return deepEqual(evalExpr(arg[0], doc), evalExpr(arg[1], doc));
    case "$ne": return !deepEqual(evalExpr(arg[0], doc), evalExpr(arg[1], doc));
    case "$gt": return compareValues(evalExpr(arg[0], doc), evalExpr(arg[1], doc)) > 0;
    case "$gte": return compareValues(evalExpr(arg[0], doc), evalExpr(arg[1], doc)) >= 0;
    case "$lt": return compareValues(evalExpr(arg[0], doc), evalExpr(arg[1], doc)) < 0;
    case "$lte": return compareValues(evalExpr(arg[0], doc), evalExpr(arg[1], doc)) <= 0;
    case "$and": {
      const arr = Array.isArray(arg) ? arg : [arg];
      return arr.every((e: any) => evalExpr(e, doc));
    }
    case "$or": {
      const arr = Array.isArray(arg) ? arg : [arg];
      return arr.some((e: any) => evalExpr(e, doc));
    }
    case "$not": return !evalExpr(Array.isArray(arg) ? arg[0] : arg, doc);
    case "$in": {
      const [needle, haystackE] = arg;
      const haystack = evalExpr(haystackE, doc);
      const needleV = evalExpr(needle, doc);
      if (!Array.isArray(haystack)) return false;
      return haystack.some((h) => deepEqual(h, needleV));
    }
    case "$dateToString": {
      const d = evalExpr(arg.date, doc);
      if (!d) return arg.format;
      const dt = d instanceof Date ? d : new Date(String(d));
      const pad = (n: number) => String(n).padStart(2, "0");
      return arg.format
        .replace("%Y", String(dt.getUTCFullYear()))
        .replace("%m", pad(dt.getUTCMonth() + 1))
        .replace("%d", pad(dt.getUTCDate()));
    }
    case "$subtract": return Number(evalExpr(arg[0], doc)) - Number(evalExpr(arg[1], doc));
    case "$divide": {
      const den = evalExpr(arg[1], doc);
      return den ? Number(evalExpr(arg[0], doc)) / Number(den) : null;
    }
    case "$multiply": return Number(evalExpr(arg[0], doc)) * Number(evalExpr(arg[1], doc));
    case "$sum": {
      if (Array.isArray(arg)) return arg.reduce((acc: number, e: any) => acc + (Number(evalExpr(e, doc)) || 0), 0);
      return Number(evalExpr(arg, doc)) || 0;
    }
    case "$toString": {
      const v = evalExpr(arg, doc);
      return v == null ? null : String(v);
    }
    default:
      return expr;
  }
}

// ---------------------------------------------------------------------------
// Aggregation pipeline
// ---------------------------------------------------------------------------

function getCollection(db: MemoryDb, name: string): MemoryCollection {
  const col = db.collections.get(name);
  if (!col) throw new Error(`[mockdb] unknown collection "${name}"`);
  return col;
}

function sortDocs(rows: Doc[], spec: Record<string, 1 | -1>): Doc[] {
  const keys = Object.keys(spec);
  if (keys.length === 0) return rows;
  const sorted = [...rows];
  sorted.sort((a, b) => {
    for (const k of keys) {
      const c = compareValues(getByPath(a, k), getByPath(b, k)) * spec[k];
      if (c !== 0) return c;
    }
    return 0;
  });
  return sorted;
}

function runAggregate(db: MemoryDb, coll: MemoryCollection, pipeline: any[]): Doc[] {
  let rows: Doc[] = coll.docs.map((d) => ({ ...d }));

  for (const stage of pipeline) {
    if (stage.$match) {
      rows = rows.filter((r) => matchFilter(r, stage.$match));
    } else if (stage.$sort) {
      rows = sortDocs(rows, stage.$sort);
    } else if (stage.$limit) {
      rows = rows.slice(0, Number(stage.$limit));
    } else if (stage.$skip) {
      rows = rows.slice(Number(stage.$skip));
    } else if (stage.$lookup) {
      const { from, localField, foreignField, as } = stage.$lookup;
      const other = getCollection(db, from);
      rows = rows.map((r) => {
        const local = getByPath(r, localField);
        const matched = other.docs.filter((o) => deepEqual(getByPath(o, foreignField), local));
        return { ...r, [as]: matched.map((o) => ({ ...o })) };
      });
    } else if (stage.$addFields || stage.$project) {
      const spec = stage.$addFields || stage.$project;
      const isProject = Boolean(stage.$project);
      rows = rows.map((r) => {
        const out: Doc = isProject ? {} : { ...r };
        for (const [k, e] of Object.entries(spec)) {
          if (k === "_id" && isProject) continue;
          out[k] = evalExpr(e, r);
        }
        return out;
      });
    } else if (stage.$unset) {
      const fields: string[] = typeof stage.$unset === "string" ? [stage.$unset] : stage.$unset;
      rows = rows.map((r) => {
        const out = { ...r };
        for (const f of fields) delete out[f];
        return out;
      });
    } else if (stage.$group) {
      const { _id, ...accSpec } = stage.$group;
      const groups = new Map<any, { key: any; accs: Record<string, any[]> }>();

      const groupKey = (r: Doc): any => {
        if (typeof _id === "string" && _id.startsWith("$")) return getByPath(r, _id.slice(1));
        if (_id !== null && typeof _id === "object") return evalExpr(_id, r);
        return _id;
      };

      for (const r of rows) {
        let key = groupKey(r);
        if (key === undefined) key = null;
        const arrKey = JSON.stringify(key instanceof Date ? { $d: key.getTime() } : key);
        if (!groups.has(arrKey)) groups.set(arrKey, { key, accs: {} });
        const g = groups.get(arrKey)!;
        for (const [accName, accExpr] of Object.entries(accSpec)) {
          (g.accs[accName] ||= []).push(evalExpr(accExpr, r) as any);
        }
      }

      rows = [...groups.values()].map(({ key, accs }) => {
        const out: Doc = { _id: key };
        for (const [name, vals] of Object.entries(accs)) {
          const specOf = stage.$group[name];
          const accOp = specOf && typeof specOf === "object" && !Array.isArray(specOf) && !(specOf instanceof Date)
            ? Object.keys(specOf).find((k) => k.startsWith("$"))
            : null;
          const numeric = vals.filter((v) => typeof v === "number");
          switch (accOp) {
            case "$sum": out[name] = numeric.reduce((a: number, b: number) => a + b, 0); break;
            case "$avg": out[name] = numeric.length ? numeric.reduce((a: number, b: number) => a + b, 0) / numeric.length : 0; break;
            case "$min": out[name] = vals.length ? vals.reduce((a: any, b: any) => compareValues(a, b) <= 0 ? a : b) : null; break;
            case "$max": out[name] = vals.length ? vals.reduce((a: any, b: any) => compareValues(a, b) >= 0 ? a : b) : null; break;
            case "$first": out[name] = vals[0]; break;
            case "$last": out[name] = vals[vals.length - 1]; break;
            case "$push": out[name] = vals; break;
            default: out[name] = vals[vals.length - 1]; break;
          }
        }
        return out;
      });
    } else {
      // Unknown stage — pass through (future-proofing).
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Cursor + Collection
// ---------------------------------------------------------------------------

export class MemoryCursor {
  private _sort: Record<string, 1 | -1> | null = null;
  private _limit: number | null = null;
  private _skip = 0;

  constructor(private rows: Doc[]) {}

  sort(spec: Record<string, 1 | -1>) {
    this._sort = spec;
    return this;
  }

  limit(n: number) {
    this._limit = n;
    return this;
  }

  skip(n: number) {
    this._skip = n;
    return this;
  }

  toArray(): Promise<Doc[]> {
    let rows = this.rows;
    if (this._sort) rows = sortDocs(rows, this._sort as Record<string, 1 | -1>);
    if (this._skip) rows = rows.slice(this._skip);
    if (this._limit != null) rows = rows.slice(0, this._limit);
    return Promise.resolve(rows.map((r) => ({ ...r })));
  }
}

function applyProjection(doc: Doc, projection: Record<string, any>): Doc {
  if (!projection) return doc;
  const entries = Object.entries(projection);
  // _id: 0 combined with inclusions is still "inclusion mode" in MongoDB —
  // only a non-_id zero triggers true exclusion semantics.
  const nonIdEntries = entries.filter(([k]) => k !== "_id");
  const hasExclusion = nonIdEntries.some(([, v]) => v === 0 || v === false);
  // Exclusion mode ({ field: 0 }) — everything except the listed keys.
  if (hasExclusion) {
    const out = { ...doc };
    for (const [k, v] of entries) {
      if (v === 0 || v === false) delete out[k];
    }
    return out;
  }
  // Inclusion mode ({ field: 1 }) — _id is included unless disabled explicitly.
  const out: Doc = {};
  if (projection._id !== 0) out._id = doc._id;
  for (const [k, v] of entries) {
    if ((v === 1 || v === true) && k !== "_id") out[k] = doc[k];
  }
  return out;
}

export class MemoryCollection {
  constructor(private db: MemoryDb, private name: string, public docs: Doc[] = []) {}

  find(filter: Filter = {}, opts: { projection?: Record<string, any> } = {}) {
    const matched = this.docs.filter((d) => matchFilter(d, filter)).map((d) => applyProjection(d, opts.projection || {}));
    return new MemoryCursor(matched);
  }

  async findOne(filter: Filter = {}, opts: { projection?: Record<string, any> } = {}): Promise<Doc | null> {
    for (const d of this.docs) {
      if (matchFilter(d, filter)) return applyProjection({ ...d }, opts.projection || {});
    }
    return null;
  }

  async countDocuments(filter: Filter = {}): Promise<number> {
    return this.docs.filter((d) => matchFilter(d, filter)).length;
  }

  async insertOne(doc: Doc): Promise<{ insertedId: any }> {
    const copy: Doc = Array.isArray(doc) ? [...doc] : { ...doc };
    if (!copy._id) copy._id = crypto.randomUUID();
    this.docs.push(copy);
    return { insertedId: copy._id };
  }

  async insertMany(docs: Doc[]): Promise<{ insertedIds: any[]; acknowledged: boolean }> {
    const ids: any[] = [];
    for (const d of docs) {
      const copy: Doc = Array.isArray(d) ? [...d] : { ...d };
      if (!copy._id) copy._id = crypto.randomUUID();
      this.docs.push(copy);
      ids.push(copy._id);
    }
    return { insertedIds: ids, acknowledged: true };
  }

  updateOne(filter: Filter, update: Record<string, any>, opts: { upsert?: boolean } = {}) {
    return this.updateMany(filter, update, opts, true);
  }

  async updateMany(
    filter: Filter,
    update: Record<string, any>,
    opts: { upsert?: boolean } = {},
    single = false
  ): Promise<{ matchedCount: number; modifiedCount: number; upsertedId?: any }> {
    let matchedCount = 0;
    let modifiedCount = 0;
    for (const d of this.docs) {
      if (matchFilter(d, filter)) {
        if (single && matchedCount > 0) break;
        matchedCount++;
        if (this.applyUpdate(d, update)) modifiedCount++;
        if (single) break;
      }
    }
    if (matchedCount === 0 && opts.upsert) {
      const base: Doc = {};
      for (const [k, v] of Object.entries(filter)) {
        if (k.startsWith("$")) continue;
        if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && Object.keys(v).every((x) => x.startsWith("$"))) {
          base[k] = v.$eq ?? (v.$in ? v.$in[0] : null);
        } else {
          base[k] = v;
        }
      }
      const doc: Doc = { _id: crypto.randomUUID(), ...base };
      this.applyUpdate(doc, update);
      this.docs.push(doc);
      return { matchedCount: 0, modifiedCount: 1, upsertedId: doc._id };
    }
    return { matchedCount, modifiedCount };
  }

  async findOneAndUpdate(
    filter: Filter,
    update: Record<string, any>,
    opts: { upsert?: boolean; returnDocument?: "before" | "after" } = {}
  ): Promise<Doc | null> {
    for (const d of this.docs) {
      if (matchFilter(d, filter)) {
        const before = { ...d };
        const after = { ...before };
        this.applyUpdate(after, update);
        Object.keys(d).forEach((k) => delete d[k]);
        Object.assign(d, after);
        return opts.returnDocument === "before" ? before : after;
      }
    }
    if (opts.upsert) {
      const base: Doc = {};
      for (const [k, v] of Object.entries(filter)) {
        if (k.startsWith("$")) continue;
        if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && Object.keys(v).every((x) => x.startsWith("$"))) {
          base[k] = v.$eq ?? (v.$in ? v.$in[0] : null);
        } else {
          base[k] = v;
        }
      }
      const doc: Doc = { _id: crypto.randomUUID(), ...base };
      this.applyUpdate(doc, update);
      this.docs.push(doc);
      return doc;
    }
    return null;
  }

  private applyUpdate(doc: Doc, update: Record<string, any>): boolean {
    let changed = false;
    for (const [op, fields] of Object.entries(update)) {
      if (op === "$set") {
        for (const [k, v] of Object.entries(fields)) {
          if (!deepEqual(doc[k], v)) changed = true;
          doc[k] = v instanceof Date && !(v instanceof Date) ? v : v;
        }
      } else if (op === "$inc") {
        for (const [k, v] of Object.entries(fields)) {
          const next = (Number(doc[k]) || 0) + Number(v);
          if (doc[k] !== next) changed = true;
          doc[k] = next;
        }
      } else if (op === "$setOnInsert") {
        // only meaningful on insert; nothing to do for updates
      } else if (op === "$unset") {
        for (const k of Object.keys(fields)) {
          if (k in doc) changed = true;
          delete doc[k];
        }
      }
    }
    return changed;
  }

  async deleteOne(filter: Filter): Promise<{ deletedCount: number }> {
    for (let i = 0; i < this.docs.length; i++) {
      if (matchFilter(this.docs[i], filter)) {
        this.docs.splice(i, 1);
        return { deletedCount: 1 };
      }
    }
    return { deletedCount: 0 };
  }

  async deleteMany(filter: Filter): Promise<{ deletedCount: number }> {
    const before = this.docs.length;
    this.docs = this.docs.filter((d) => !matchFilter(d, filter));
    return { deletedCount: before - this.docs.length };
  }

  createIndex() {
    /* no-op — in-memory store needs no indexes */
    return Promise.resolve("mock-index");
  }

  async distinct(field: string, query: Filter = {}): Promise<any[]> {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const d of this.docs) {
      if (!matchFilter(d, query)) continue;
      const v = getByPath(d, field);
      const key = JSON.stringify(v instanceof Date ? { $d: v.getTime() } : v);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(v);
      }
    }
    return out;
  }

  aggregate(pipeline: any[]) {
    return new MemoryCursor(runAggregate(this.db, this, pipeline));
  }

  async drop() {
    this.docs = [];
  }
}

// ---------------------------------------------------------------------------
// Database facade
// ---------------------------------------------------------------------------

export class MemoryDb {
  readonly collections = new Map<string, MemoryCollection>();

  collection(name: string): MemoryCollection {
    let c = this.collections.get(name);
    if (!c) {
      c = new MemoryCollection(this, name);
      this.collections.set(name, c);
    }
    return c;
  }

  async command(cmd: Record<string, any>): Promise<any> {
    if (cmd.ping !== undefined) return { ok: 1 };
    if (cmd.hello !== undefined) return { ok: 1 };
    return { ok: 1 };
  }
}

export function createMemoryDb(): MemoryDb {
  return new MemoryDb();
}