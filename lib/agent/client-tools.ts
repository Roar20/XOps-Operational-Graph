"use client";
/**
 * Ejecutor de las herramientas de cliente del agente. Todo lo que toca el
 * corpus QN se resuelve aqui, contra IndexedDB, porque el corpus vive en el
 * navegador de quien lo carga y no en el build.
 *
 * Cada respuesta viaja con su procedencia: hoja de origen, filas cargadas,
 * poblacion representada y si describe el corpus completo o una muestra. El
 * agente tiene prohibido dar una cifra sin eso, y aqui se le entrega junto al
 * dato para que no tenga que deducirlo.
 */
import { openExisting, readCorpus } from "@/lib/qn/db";
import type { Dataset, DatasetId } from "@/lib/qn/types";

const norm = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const NOT_LOADED = {
  corpus_loaded: false,
  note:
    "No corpus is loaded in this browser. Say so. Do not answer corpus questions " +
    "from any other source, and do not estimate.",
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

function scan(
  db: IDBDatabase,
  store: string,
  visit: (row: any) => boolean,
  limit: number,
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
      if (visit(cur.value)) {
        count++;
        if (out.length < limit) out.push(cur.value);
      }
      cur.continue();
    };
    req.onerror = () => resolve({ count, sample: out });
  });
}

const provOf = (d?: Dataset) =>
  d
    ? {
        source_sheet: d.provenance.sourceSheet,
        scope: d.provenance.scope,
        loaded_rows: d.provenance.loadedRows,
        represented_rows: d.provenance.representedRows,
        calculation: d.provenance.calculation,
      }
    : null;

export async function runClientTool(name: string, input: any): Promise<unknown> {
  const corpus = await readCorpus();
  if (!corpus) return NOT_LOADED;
  const { snapshot, datasets } = corpus;
  const ds = (id: DatasetId) => datasets[id];

  const header = {
    as_of: snapshot.asOf,
    instrument: snapshot.instrument,
    workbook_verified: snapshot.workbookVerified,
    file: snapshot.fileName,
  };

  switch (name) {
    case "corpus_status":
      return {
        corpus_loaded: true,
        ...header,
        declared_population: snapshot.population,
        datasets: Object.fromEntries(
          Object.entries(datasets).map(([k, d]) => [
            k,
            {
              scope: d!.provenance.scope,
              loaded_rows: d!.provenance.loadedRows,
              represented_rows: d!.provenance.representedRows,
              source_sheet: d!.provenance.sourceSheet,
            },
          ]),
        ),
        failed_invariants: snapshot.invariants
          .filter((i) => !i.passed)
          .map((i) => ({ id: i.id, class: i.cls, statement: i.statement, detail: i.detail })),
        unverified_datasets: snapshot.unverifiedDatasets,
        note: snapshot.asOf
          ? undefined
          : "Structural invariants failed, so no cut-off is stamped. Report every figure as unverified.",
      };

    case "corpus_summary": {
      const ov = ds("overview");
      const dual = ds("dualAxis");
      const cn = ds("complianceCloseNotes");
      return {
        ...header,
        declared_population: snapshot.population,
        overview_facts: ov?.facts ?? null,
        dual_axis: { bands: dual?.rows ?? [], total: dual?.facts?.total ?? null, provenance: provOf(dual) },
        close_notes_kpi: { kpi: cn?.facts?.["OVERALL KPI"] ?? null, provenance: provOf(cn) },
        blocked: ["MTTR", "SLA attainment", "backlog age", "reassignment count"],
        unverified_datasets: snapshot.unverifiedDatasets,
      };
    }

    case "assignment_group_profile": {
      const k = norm(input.name);
      const limit = Math.min(input.limit ?? 10, 25);
      const pick = (d?: Dataset) =>
        (d?.rows ?? []).filter((r: any) => norm(r["Assignment Group"]).includes(k)).slice(0, limit);

      const user = ds("userByGroup");
      const alert = ds("alertByGroup");
      const deca = ds("decalogueByGroup");
      const uRows = pick(user), aRows = pick(alert), dRows = pick(deca);

      if (!uRows.length && !aRows.length) {
        return { ...header, found: false, query: input.name, note: "No assignment group matches this key." };
      }
      return {
        ...header,
        found: true,
        user_incidents: { rows: uRows, provenance: provOf(user) },
        alerts: { rows: aRows, provenance: provOf(alert) },
        decalogue: { rows: dRows, provenance: provOf(deca) },
        note:
          "Report the scope that travels with each block. A full-corpus aggregate is a " +
          "population figure; a sample is not.",
      };
    }

    case "decalogue_breakdown": {
      const bd = ds("byDecalogue");
      const val = ds("decalogueValidation");
      const s = (bd?.facts?.summary ?? {}) as Record<string, number>;
      return {
        ...header,
        measures: {
          classified_incidents: {
            value: s.classifiedIncidents ?? null,
            unit: "incident",
            note: "Distinct incidents carrying at least one code. This is the population figure.",
          },
          code_occurrences: {
            value: s.codeOccurrences ?? null,
            unit: "occurrence",
            note:
              "Sum of the Incidents column across codes. An incident with two codes counts " +
              "twice. Never present this as a population.",
          },
          overcount: s.overcount ?? null,
        },
        by_code: bd?.rows ?? [],
        provenance: provOf(bd),
        cross_cut_comparability: "BLOCKED",
        classifier_validation: { rows: val?.rows ?? [], provenance: provOf(val) },
      };
    }

    case "lookup_ticket": {
      const db = await openExisting();
      if (!db) return NOT_LOADED;
      const n = String(input.number ?? "").trim().toUpperCase();
      if (!/^INC\d+$/.test(n)) {
        db.close();
        return { found: false, note: "Not an incident number. Expected INC followed by digits." };
      }
      const user = await tx<any>(db, "user", (s) => s.get(n));
      const alert = user ? null : await tx<any>(db, "alert", (s) => s.get(n));
      db.close();
      const hit = user ?? alert;
      if (!hit) {
        return {
          ...header,
          found: false,
          number: n,
          detail_scope: ds("userDetail")?.provenance.scope ?? "unknown",
          note:
            "Not present in the rows loaded here. Where the detail sheet is a sample, absence " +
            "is not evidence that the incident is absent from the corpus. Say that.",
        };
      }
      return {
        ...header,
        found: true,
        grain: user ? "user" : "alert",
        ticket: hit,
        provenance: provOf(user ? ds("userDetail") : ds("alertDetail")),
        not_answerable: [
          "time to resolve: the corpus carries Closed At only",
          "confirmed application: derived through assignment group",
        ],
      };
    }

    case "search_tickets": {
      const db = await openExisting();
      if (!db) return NOT_LOADED;
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
      const res: any = { ...header, filters: input };
      if (grain !== "alert") res.user = { ...(await scan(db, "user", match, limit)), provenance: provOf(ds("userDetail")) };
      if (grain !== "user") res.alert = { ...(await scan(db, "alert", match, limit)), provenance: provOf(ds("alertDetail")) };
      db.close();
      res.note =
        "count is over the rows loaded in this browser. Where the detail scope is sample, the " +
        "count describes the sample and is not a corpus figure.";
      return res;
    }

    case "recurring_signatures": {
      const db = await openExisting();
      if (!db) return NOT_LOADED;
      const store = input.grain === "user" ? "user" : "alert";
      const k = input.assignment_group ? norm(input.assignment_group) : null;
      const top = Math.min(input.top ?? 15, 50);
      const agg = new Map<string, { n: number; ags: Set<string>; first?: string; last?: string }>();

      await scan(db, store, (r: any) => {
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
        return false; /* solo se agrega; no se quiere muestra */
      }, 0);
      db.close();

      const src = store === "user" ? ds("userDetail") : ds("alertDetail");
      return {
        ...header,
        grain: store,
        distinct_signatures: agg.size,
        provenance: provOf(src),
        top: [...agg.entries()]
          .map(([signature, e]) => ({
            signature,
            occurrences: e.n,
            assignment_groups: e.ags.size,
            first_seen: e.first,
            last_seen: e.last,
          }))
          .sort((a, b) => b.occurrences - a.occurrences)
          .slice(0, top),
        note:
          src?.provenance.scope === "full"
            ? "Computed over the full detail."
            : "Computed over the loaded sample. This ranking describes the sample, not the corpus.",
      };
    }

    default:
      return { error: `Unknown client tool: ${name}` };
  }
}
