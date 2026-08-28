"use client";

/**
 * Ejecutor de las herramientas de cliente. Consulta IndexedDB, donde vive el
 * detalle de 719,946 filas que nunca entra al repo ni viaja al servidor.
 *
 * Contrato con el store de ingesta (el que construye Claude Code):
 *   db  = "xops-corpus"
 *   stores:
 *     "meta"    key "current" -> { as_of, sha256, instrument, verified, rows }
 *     "user"    keyPath "Number", index "ag_key", index "Label"
 *     "alert"   keyPath "Number", index "ag_key", index "ops_class"
 *
 * Nota sobre ops_class: el contrato original pedia un indice con keyPath
 * "Ops Classification". IndexedDB lo rechaza, porque un keyPath no admite
 * espacios. La columna original sigue en la fila; el indice va sobre la copia.
 * Cada fila lleva ag_key precomputado con el normalizador canónico.
 */

import { openExisting } from "@/lib/qn/db";

const norm = (s: string) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, "");

const NOT_LOADED = {
  corpus_loaded: false,
  note:
    "No corpus is loaded in this browser. The user must upload the QN workbook " +
    "first. Do not answer ticket-level questions from any other source.",
};

function tx<T>(db: IDBDatabase, store: string, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const r = fn(db.transaction(store, "readonly").objectStore(store));
      r.onsuccess = () => resolve(r.result as T);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function scan(
  db: IDBDatabase,
  store: string,
  match: (row: any) => boolean,
  limit: number
): Promise<{ count: number; sample: any[] }> {
  return new Promise((resolve) => {
    const out: any[] = [];
    let count = 0;
    let req: IDBRequest;
    try {
      req = db.transaction(store, "readonly").objectStore(store).openCursor();
    } catch {
      return resolve({ count: 0, sample: [] });
    }
    req.onsuccess = () => {
      const cur = (req as IDBRequest<IDBCursorWithValue>).result;
      if (!cur) return resolve({ count, sample: out });
      if (match(cur.value)) {
        count++;
        if (out.length < limit) out.push(cur.value);
      }
      cur.continue();
    };
    req.onerror = () => resolve({ count, sample: out });
  });
}

export async function runClientTool(name: string, input: any): Promise<unknown> {
  const db = await openExisting();
  if (!db) return NOT_LOADED;

  const meta = await tx<any>(db, "meta", (s) => s.get("current"));
  if (!meta) return NOT_LOADED;

  switch (name) {
    case "corpus_status":
      return {
        corpus_loaded: true,
        as_of: meta.as_of,
        instrument: meta.instrument,
        manifest_verified: meta.verified === true,
        rows: meta.rows,
        warning:
          meta.verified === true
            ? undefined
            : "Corpus did not pass manifest validation. Report figures as unverified.",
      };

    case "lookup_ticket": {
      const n = String(input.number ?? "").trim().toUpperCase();
      if (!/^INC\d+$/.test(n)) {
        return { found: false, note: "Not an incident number. Expected INC followed by digits." };
      }
      const user = await tx<any>(db, "user", (s) => s.get(n));
      if (user) {
        return {
          found: true,
          grain: "user",
          as_of: meta.as_of,
          evidence_tier: "E2",
          ticket: user,
          not_answerable: [
            "time to resolve: no opened_at in this corpus",
            "confirmed application: derived through assignment group, 61.8% volume coverage",
          ],
        };
      }
      const alert = await tx<any>(db, "alert", (s) => s.get(n));
      if (alert) {
        return {
          found: true,
          grain: "alert",
          as_of: meta.as_of,
          evidence_tier: "E2",
          ticket: alert,
          not_answerable: ["time to resolve: no opened_at in this corpus"],
        };
      }
      return {
        found: false,
        number: n,
        note: "Not present in the loaded cut-off. Say so; do not infer it exists elsewhere.",
      };
    }

    case "search_tickets": {
      const k = input.assignment_group ? norm(input.assignment_group) : null;
      const txt = input.text_contains ? String(input.text_contains).toLowerCase() : null;
      const limit = Math.min(input.limit ?? 20, 50);
      const match = (r: any) =>
        (!k || String(r.ag_key ?? norm(r["Assignment Group"])).includes(k)) &&
        (!input.label || r["Label"] === input.label) &&
        (!input.compliance_class || r["compliance_class"] === input.compliance_class) &&
        (!input.ops_classification || r["Ops Classification"] === input.ops_classification) &&
        (!input.decalogue_code ||
          String(r["Decalogue All v2"] ?? r["Decalogue All"] ?? "").includes(input.decalogue_code)) &&
        (!txt || String(r["Short Description"] ?? "").toLowerCase().includes(txt));

      const grain = input.grain ?? "both";
      const res: any = { as_of: meta.as_of, evidence_tier: "E2", filters: input };
      if (grain !== "alert") res.user = await scan(db, "user", match, limit);
      if (grain !== "user") res.alert = await scan(db, "alert", match, limit);
      res.note =
        "count is the population figure. sample is illustration only and must not be " +
        "presented as the result set.";
      return res;
    }

    case "recurring_signatures": {
      const store = input.grain === "user" ? "user" : "alert";
      const k = input.assignment_group ? norm(input.assignment_group) : null;
      const top = Math.min(input.top ?? 15, 50);
      const agg = new Map<string, { n: number; ags: Set<string>; first?: string; last?: string }>();

      await scan(
        db,
        store,
        (r: any) => {
          if (k && !String(r.ag_key ?? norm(r["Assignment Group"])).includes(k)) return false;
          const sig = String(r["Short Description"] ?? "").slice(0, 120);
          if (!sig) return false;
          const e = agg.get(sig) ?? { n: 0, ags: new Set<string>() };
          e.n++;
          e.ags.add(String(r["Assignment Group"]));
          const d = r["Closed At"];
          if (d) {
            if (!e.first || d < e.first) e.first = d;
            if (!e.last || d > e.last) e.last = d;
          }
          agg.set(sig, e);
          return false; // sólo agregamos, no queremos muestra
        },
        0
      );

      const rows = [...agg.entries()]
        .map(([sig, e]) => ({
          signature: sig,
          incidents: e.n,
          assignment_groups: e.ags.size,
          top_ag: [...e.ags][0],
          first_seen: e.first,
          last_seen: e.last,
          suppression_candidate: e.ags.size === 1 && e.n >= 500,
        }))
        .sort((a, b) => b.incidents - a.incidents)
        .slice(0, top);

      return {
        as_of: meta.as_of,
        grain: store,
        distinct_signatures: agg.size,
        top: rows,
        rule:
          "suppression_candidate means one assignment group and 500 or more occurrences. " +
          "That is a monitoring configuration problem, not an incident problem.",
      };
    }

    default:
      return { error: `Unknown client tool: ${name}` };
  }
}
