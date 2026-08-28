/// <reference lib="webworker" />
/**
 * Ingesta del corpus QN en el navegador. El libro que se sube es la fuente de
 * verdad: no hay JSON pregenerado ni paso de proyeccion previo.
 *
 * Nada viaja a un servidor. El detalle queda en IndexedDB de quien lo carga.
 *
 * EL ALCANCE ES POR DATASET, NO POR LIBRO
 * Este corpus trae hojas de detalle muestreadas y hojas agregadas que cubren la
 * poblacion entera. Cada dataset se somete a su propia prueba de cobertura y
 * carga esa respuesta hasta la interfaz. Ninguna poblacion esta escrita en el
 * codigo: se lee de la hoja Overview del libro.
 *
 * Sobre ops_class: IndexedDB rechaza un keyPath con espacios, de modo que un
 * indice sobre "Ops Classification" no es construible. Cada alerta lleva una
 * copia en ops_class y el indice va sobre ella; la columna original se conserva
 * intacta para procedencia. Es detalle de implementacion, no concepto de usuario.
 */
import * as XLSX from "xlsx";
import {
  SHEETS, POPULATION_KEYS, INVARIANTS, EXCLUDED_REASON, agKey, type SheetSpec,
} from "./contract";
import type {
  CorpusSnapshot, Dataset, DatasetId, IngestProgress, InvariantResult,
  Population, Provenance, Scope, SheetVerdict,
} from "./types";

const DB = "xops-corpus";
const VERSION = 2;
const BATCH = 2000;

type Row = Record<string, unknown>;
type Cell = string | number | null;

const post = (m: IngestProgress) => (self as unknown as Worker).postMessage(m);

async function sha256(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** '719,946' -> 719946 · '38.5%' -> 38.5 · lo demas -> null */
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const m = v.trim().replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      try {
        const db = req.result;
        for (const s of ["meta", "user", "alert", "datasets"]) {
          if (db.objectStoreNames.contains(s)) db.deleteObjectStore(s);
        }
        db.createObjectStore("meta");
        db.createObjectStore("datasets");
        const user = db.createObjectStore("user", { keyPath: "Number" });
        user.createIndex("ag_key", "ag_key");
        user.createIndex("Label", "Label");
        const alert = db.createObjectStore("alert", { keyPath: "Number" });
        alert.createIndex("ag_key", "ag_key");
        alert.createIndex("ops_class", "ops_class");
      } catch (err) {
        try { req.transaction?.abort(); } catch { /* ya viene fallando */ }
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB could not be opened."));
    req.onblocked = () => reject(new Error("Another tab has the corpus open. Close it and try again."));
  });
}

const gridOf = (ws: XLSX.WorkSheet): Cell[][] =>
  XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, blankrows: false, defval: null });

const filled = (r: Cell[]) => r.filter((c) => c !== null && String(c).trim() !== "");

/**
 * Hoja de banner: titulo, secciones, pares clave/valor y sub-tablas. Las hojas
 * de cumplimiento traen el KPI arriba y una tabla por grupo debajo, asi que un
 * parser de solo clave/valor perderia la mitad del contenido.
 */
function parseBanner(rows: Cell[][]) {
  const facts: Record<string, Record<string, string | number>> = {};
  const tables: Record<string, { header: string[]; rows: Row[] }> = {};
  let section = "_header";
  let header: string[] | null = null;

  for (const raw of rows) {
    const cells = raw.map((c) => (c === null ? "" : String(c).trim()));
    const nonEmpty = filled(raw);
    if (nonEmpty.length === 0) continue;

    if (nonEmpty.length === 1 && cells[0]) {
      section = cells[0];
      header = null;
      continue;
    }
    if (nonEmpty.length >= 3) {
      if (!header) {
        header = cells.map((c, i) => c || `col${i}`);
        tables[section] = { header, rows: [] };
        continue;
      }
      const obj: Row = {};
      header.forEach((h, i) => { obj[h] = raw[i] ?? null; });
      tables[section]?.rows.push(obj);
      continue;
    }
    const k = cells[0];
    if (k) {
      facts[section] = facts[section] ?? {};
      facts[section][k] = num(cells[1]) ?? cells[1];
    }
  }
  return { facts, tables };
}

/** Hoja tabular: encabezado en la fila 1. */
function parseTable(rows: Cell[][], columns: string[]) {
  const header = (rows[0] ?? []).map((c) => String(c ?? "").trim());
  const out: Row[] = [];
  for (const raw of rows.slice(1)) {
    if (filled(raw).length === 0) continue;
    const obj: Row = {};
    header.forEach((h, i) => { if (h) obj[h] = raw[i] ?? null; });
    out.push(obj);
  }
  return {
    header,
    rows: out,
    missing: columns.filter((c) => !header.includes(c)),
    extra: header.filter((h) => h && !columns.includes(h)),
  };
}

self.onmessage = async (e: MessageEvent<{ file: File }>) => {
  const results: InvariantResult[] = [];
  const record = (id: string, passed: boolean, detail: string) => {
    const spec = INVARIANTS.find((i) => i.id === id)!;
    results.push({ id, cls: spec.cls, statement: spec.statement, passed, detail, guards: spec.guards });
  };

  try {
    const file = e.data.file;
    post({ phase: "reading", pct: 4 });
    const buf = await file.arrayBuffer();
    const sha = await sha256(buf);

    post({ phase: "parsing", pct: 12, note: "opening the workbook" });
    const wb = XLSX.read(buf, { type: "array", cellDates: false, dense: true });
    const grids = new Map<string, Cell[][]>();
    for (const n of wb.SheetNames) grids.set(n, gridOf(wb.Sheets[n]));

    /* ---------- poblacion declarada, leida del libro ---------- */
    post({ phase: "validating", pct: 25 });
    const overviewRows = grids.get("Overview") ?? [];
    const overview = parseBanner(overviewRows);
    const findFact = (label: string): number | null => {
      for (const sect of Object.values(overview.facts)) {
        for (const [k, v] of Object.entries(sect)) if (k.trim() === label) return num(v);
      }
      return null;
    };
    const population: Population = {
      total: findFact(POPULATION_KEYS.total),
      user: findFact(POPULATION_KEYS.user),
      alert: findFact(POPULATION_KEYS.alert),
    };
    /* La celda C1 de Overview trae la hora en que se genero el reporte, NO el
       corte del dato. Son cosas distintas y confundirlas convierte un sello en
       una afirmacion falsa. Se busca un corte declarado explicitamente; si el
       libro no lo declara, no se inventa: asOf queda nulo y la interfaz dice
       que el libro no lo declara. */
    const generatedAt = String(overviewRows[0]?.[2] ?? "").trim() || null;
    const instrument = String(overviewRows[0]?.[0] ?? "QN Work Notes Quality Analyzer");
    let declaredCutOff: string | null = null;
    for (const g of grids.values()) {
      for (const row of g) {
        const line = row.map((c) => (c === null ? "" : String(c))).join(" | ");
        const m = line.match(/cut[- ]?off[^0-9]{0,20}(\d{4}-\d{2}-\d{2})/i);
        if (m) { declaredCutOff = m[1]; break; }
      }
      if (declaredCutOff) break;
    }

    /* ---------- estructura ---------- */
    const parsed = new Map<string, ReturnType<typeof parseTable>>();
    const verdicts: SheetVerdict[] = [];
    const missingSheets: string[] = [];
    const brokenColumns: string[] = [];

    for (const [name, spec] of Object.entries(SHEETS) as [string, SheetSpec][]) {
      const present = grids.has(name);
      if (!present) missingSheets.push(name);
      const g = grids.get(name) ?? [];
      const banner = spec.role === "banner";
      const t = banner ? null : parseTable(g, spec.columns);
      if (t) parsed.set(name, t);
      if (t && t.missing.length) brokenColumns.push(`${name} (${t.missing.length})`);

      verdicts.push({
        sheet: name,
        present,
        role: spec.role,
        scope: "unknown",
        loadedRows: banner ? Math.max(0, g.length - 1) : t?.rows.length ?? 0,
        representedRows: null,
        missingColumns: t?.missing ?? [],
        extraColumns: t?.extra ?? [],
        ok: present && !(t && t.missing.length > 0),
      });
    }

    record("QN01", missingSheets.length === 0,
      missingSheets.length ? `absent: ${missingSheets.join(", ")}` : `${wb.SheetNames.length} sheets`);
    record("QN02", brokenColumns.length === 0,
      brokenColumns.length ? `columns absent in ${brokenColumns.join(", ")}` : "every contract column present");

    if (!grids.has("User_Detail") || !grids.has("Alert_Detail")) {
      post({ phase: "error", message: "No User_Detail and no Alert_Detail. Nothing was written to this browser." });
      return;
    }

    /* ---------- alcance por hoja, probado contra la poblacion del libro ---------- */
    type ScopeInfo = { scope: Scope; represented: number | null; evidence: string };
    const bannerOf = new Map<string, ReturnType<typeof parseBanner>>();
    const banner = (n: string) => {
      if (!bannerOf.has(n)) bannerOf.set(n, parseBanner(grids.get(n) ?? []));
      return bannerOf.get(n)!;
    };

    const scopeOf = (name: string): ScopeInfo => {
      const spec = SHEETS[name];
      const t = parsed.get(name);

      /* Segunda via: la hoja declara su propia poblacion adentro. Si coincide
         con la que declara Overview, se computo sobre el corpus completo. */
      if (spec?.fullIfDeclares) {
        const target = population[spec.fullIfDeclares.against];
        const lbl = spec.fullIfDeclares.label;
        let declared: number | null = null;
        if (lbl === "__totalRow__" && t) {
          const lc = spec.columns[0];
          declared = num(t.rows.find((r) => String(r[lc]).trim() === "Total")?.Total ?? null);
        } else if (lbl === "__decalogueDenominator__" && t) {
          /* "Classified incidents | 35,814 / 277,408 (12.9%)": el denominador
             es lo que prueba que la hoja cubre el corpus, no el numerador. */
          const raw = String(t.rows.find((r) => String(r.Code ?? "").includes("Classified"))?.Pattern ?? "");
          declared = num(raw.split("/")[1] ?? "");
        } else {
          for (const sect of Object.values(banner(name).facts)) {
            for (const [k, v] of Object.entries(sect)) if (k.trim() === lbl) declared = num(v);
          }
        }
        if (target != null && declared != null) {
          return {
            scope: declared === target ? "full" : "sample",
            represented: target,
            evidence: `sheet declares ${declared.toLocaleString("en-US")} vs Overview ${target.toLocaleString("en-US")}`,
          };
        }
      }

      if (!spec?.fullIf || !t) return { scope: "unknown", represented: null, evidence: "no coverage test defined" };
      const target = population[spec.fullIf.against];
      if (target == null) return { scope: "unknown", represented: null, evidence: "Overview declares no population" };
      const measured = spec.fullIf.sumColumn === "__rowcount__"
        ? t.rows.length
        : t.rows.reduce((s, r) => s + (num(r[spec.fullIf!.sumColumn]) ?? 0), 0);
      const what = spec.fullIf.sumColumn === "__rowcount__" ? "rows" : `sum of ${spec.fullIf.sumColumn}`;
      return {
        scope: measured === target ? "full" : "sample",
        represented: target,
        evidence: `${what} ${measured.toLocaleString("en-US")} vs declared ${target.toLocaleString("en-US")}`,
      };
    };

    const scopes = new Map<string, ScopeInfo>();
    for (const name of Object.keys(SHEETS)) scopes.set(name, scopeOf(name));
    for (const v of verdicts) {
      const s = scopes.get(v.sheet)!;
      v.scope = s.scope;
      v.representedRows = s.represented;
    }

    record("QN03", scopes.get("User_By_Group")!.scope === "full", scopes.get("User_By_Group")!.evidence);
    record("QN04", scopes.get("Alert_By_Group")!.scope === "full", scopes.get("Alert_By_Group")!.evidence);
    record("QN05",
      population.user != null && population.alert != null && population.total != null &&
        population.user + population.alert === population.total,
      `${population.user ?? "—"} + ${population.alert ?? "—"} vs ${population.total ?? "—"}`);

    /* ---------- Dual_Axis ---------- */
    const dual = parsed.get("Dual_Axis");
    const labelCol = SHEETS.Dual_Axis.columns[0];
    const dualTotal = dual?.rows.find((r) => String(r[labelCol]).trim() === "Total") ?? null;
    const dualBands = (dual?.rows ?? []).filter((r) => r !== dualTotal);
    record("QN06", !!dualTotal && num(dualTotal.Total) === population.user,
      `${num(dualTotal?.Total ?? null) ?? "—"} vs ${population.user ?? "—"}`);
    const axisCols = ["DIAGNOSTICO (n)", "SUSTANTIVO (n)", "FORMAL_ONLY (n)", "EMPTY (n)"];
    const badAxis = axisCols.filter(
      (c) => dualBands.reduce((s, r) => s + (num(r[c]) ?? 0), 0) !== num(dualTotal?.[c] ?? null));
    record("QN07", badAxis.length === 0,
      badAxis.length ? `do not reconcile: ${badAxis.join(", ")}` : "four classes reconcile");

    /* ---------- By_Decalogue: dos medidas distintas, no una ---------- */
    const bd = parsed.get("By_Decalogue");
    const codeRows = (bd?.rows ?? []).filter((r) => /^D\d{2}$/.test(String(r.Code ?? "").trim()));
    const summaryRows = (bd?.rows ?? []).filter((r) => !codeRows.includes(r));
    const occurrences = codeRows.reduce((s, r) => s + (num(r.Incidents) ?? 0), 0);
    const classified = num(summaryRows.find((r) => String(r.Code ?? "").includes("Classified"))?.Pattern ?? null);
    const codesOk = new Set(codeRows.map((r) => String(r.Code).trim())).size === 10;
    record("QN08", codesOk && classified != null && occurrences >= classified,
      classified != null
        ? `${codeRows.length} codes · ${occurrences.toLocaleString("en-US")} occurrences vs ${classified.toLocaleString("en-US")} classified · overcount ${(occurrences - classified).toLocaleString("en-US")}`
        : `${codeRows.length} codes · classified incidents not found`);

    /* ---------- validacion del clasificador ---------- */
    const dv = parseBanner(grids.get("Decalogue_Validation") ?? []);
    const dvMatrix = Object.values(dv.tables).find((t) => t.header.some((h) => /v1 Incidents/i.test(h)));
    record("QN09", !!dvMatrix && dvMatrix.rows.length >= 10,
      dvMatrix ? `${dvMatrix.rows.length} codes in the A/B matrix` : "A/B matrix absent");

    /* ---------- claves de grupo ---------- */
    const ubg = parsed.get("User_By_Group");
    const names = (ubg?.rows ?? []).map((r) => String(r["Assignment Group"] ?? "")).filter(Boolean);
    record("QN10", names.length === new Set(names).size,
      `${names.length} names, ${new Set(names).size} distinct`);
    const keys = new Set(names.map(agKey));
    record("QN11", new Set(names).size === keys.size,
      `${new Set(names).size} names -> ${keys.size} canonical keys`);

    /* ---------- cumplimiento ---------- */
    const cn = parseBanner(grids.get("Compliance_CloseNotes") ?? []);
    const ca = parseBanner(grids.get("Compliance_Alerts") ?? []);
    const kpi = cn.facts["OVERALL KPI"] ?? {};
    record("QN12", kpi["Population rate %"] != null && kpi["Target %"] != null,
      `rate ${kpi["Population rate %"] ?? "—"} · target ${kpi["Target %"] ?? "—"}`);

    /* ---------- MTTR ---------- */
    const opened: string[] = [];
    for (const n of ["User_Detail", "Alert_Detail"]) {
      for (const h of parsed.get(n)?.header ?? []) {
        if (/open(ed)?[ _]?at|created/i.test(h)) opened.push(`${n}.${h}`);
      }
    }
    record("QN13", opened.length === 0, opened.length ? `suspicious columns: ${opened.join(", ")}` : "Closed At only");

    /* ---------- datasets ---------- */
    post({ phase: "deriving", pct: 55 });
    const prov = (sheet: string, calculation: string, loaded: number): Provenance => {
      const s = scopes.get(sheet) ?? { scope: "unknown" as Scope, represented: null, evidence: "" };
      return {
        sourceSheet: sheet,
        scope: s.scope,
        loadedRows: loaded,
        representedRows: s.represented,
        calculation,
        scopeEvidence: s.evidence,
      };
    };
    const tableRows = (n: string) => parsed.get(n)?.rows ?? [];

    const datasets: Dataset[] = [
      {
        id: "overview", sheet: "Overview", present: true, rows: [], facts: overview.facts,
        provenance: prov("Overview", "Key/value blocks read verbatim.", overviewRows.length),
      },
      {
        id: "userByGroup", sheet: "User_By_Group", present: !!ubg, rows: tableRows("User_By_Group"),
        provenance: prov("User_By_Group", "Rows read verbatim. Group-level population metrics come from here.", tableRows("User_By_Group").length),
      },
      {
        id: "alertByGroup", sheet: "Alert_By_Group", present: parsed.has("Alert_By_Group"), rows: tableRows("Alert_By_Group"),
        provenance: prov("Alert_By_Group", "Rows read verbatim.", tableRows("Alert_By_Group").length),
      },
      {
        id: "byDecalogue", sheet: "By_Decalogue", present: !!bd, rows: codeRows,
        facts: { summary: { classifiedIncidents: classified ?? 0, codeOccurrences: occurrences, overcount: occurrences - (classified ?? 0) } },
        provenance: prov("By_Decalogue", "Ten code rows. Occurrences sum the Incidents column and exceed classified incidents by design.", codeRows.length),
      },
      {
        id: "decalogueByGroup", sheet: "Decalogue_By_Group", present: parsed.has("Decalogue_By_Group"), rows: tableRows("Decalogue_By_Group"),
        provenance: prov("Decalogue_By_Group", "Rows read verbatim.", tableRows("Decalogue_By_Group").length),
      },
      {
        id: "dualAxis", sheet: "Dual_Axis", present: !!dual, rows: dualBands,
        facts: { total: Object.fromEntries(Object.entries(dualTotal ?? {}).map(([k, v]) => [k, num(v) ?? String(v)])) },
        provenance: prov("Dual_Axis", "Four band rows; the Total row is kept apart, never summed with them.", dualBands.length),
      },
      {
        id: "decalogueValidation", sheet: "Decalogue_Validation", present: !!dvMatrix, rows: dvMatrix?.rows ?? [], facts: dv.facts,
        provenance: prov("Decalogue_Validation", "A/B matrix by D-code, v1 against v2.", dvMatrix?.rows.length ?? 0),
      },
      {
        id: "complianceCloseNotes", sheet: "Compliance_CloseNotes", present: true,
        rows: cn.tables["BY ASSIGNMENT GROUP"]?.rows ?? [], facts: cn.facts,
        provenance: prov("Compliance_CloseNotes", "Overall KPI block plus the by-group table.", cn.tables["BY ASSIGNMENT GROUP"]?.rows.length ?? 0),
      },
      {
        id: "complianceAlerts", sheet: "Compliance_Alerts", present: true,
        rows: ca.tables["BY ASSIGNMENT GROUP"]?.rows ?? [], facts: ca.facts,
        provenance: prov("Compliance_Alerts", "Overall KPI block plus the by-group table.", ca.tables["BY ASSIGNMENT GROUP"]?.rows.length ?? 0),
      },
    ];

    /* ---------- detalle ---------- */
    post({ phase: "parsing", pct: 68, note: "reading detail sheets" });
    const discarded: CorpusSnapshot["discarded"] = [];
    const prep = (rows: Row[], store: "user" | "alert") => {
      const seen = new Set<string>();
      const out: Row[] = [];
      let noNumber = 0, dup = 0;
      for (const r of rows) {
        const n = String(r["Number"] ?? "").trim();
        if (!n) { noNumber++; continue; }
        if (seen.has(n)) { dup++; continue; }
        seen.add(n);
        const row: Row = { ...r, Number: n, ag_key: agKey(r["Assignment Group"]) };
        if (store === "alert") row.ops_class = r["Ops Classification"] ?? null;
        out.push(row);
      }
      if (noNumber) discarded.push({ store, reason: "no Number: cannot be indexed", rows: noNumber });
      if (dup) discarded.push({ store, reason: "Number repeated inside the file", rows: dup });
      return out;
    };
    const userRows = prep(tableRows("User_Detail"), "user");
    const alertRows = prep(tableRows("Alert_Detail"), "alert");

    /* Rango de Closed At de lo que se cargo. Se publica como observacion, no
       como conclusion: una muestra ordenada por fecha cubre un tramo y no el
       periodo del corpus, y quien lea la cifra necesita verlo. */
    const closedRange = (rows: Row[]) => {
      const ds = rows.map((r) => String(r["Closed At"] ?? "").slice(0, 10)).filter(Boolean).sort();
      return ds.length ? { first: ds[0], last: ds[ds.length - 1] } : null;
    };

    datasets.push(
      {
        id: "userDetail", sheet: "User_Detail", present: true, rows: [],
        facts: { closedAt: (closedRange(userRows) ?? {}) as Record<string, string> },
        provenance: prov("User_Detail", "Indexed by Number. Detail serves inspection, examples and drill-down.", userRows.length),
      },
      {
        id: "alertDetail", sheet: "Alert_Detail", present: true, rows: [],
        facts: { closedAt: (closedRange(alertRows) ?? {}) as Record<string, string> },
        provenance: prov("Alert_Detail", "Indexed by Number.", alertRows.length),
      },
    );

    /* ---------- que queda sin poder presentarse como verificado ---------- */
    const structuralOk = results.filter((r) => r.cls === "structural").every((r) => r.passed);
    const unverified = new Set<string>();
    for (const f of results.filter((r) => !r.passed)) for (const g of f.guards) unverified.add(g);

    /* ---------- escritura ---------- */
    const db = await openDb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(["user", "alert", "meta", "datasets"], "readwrite");
      for (const s of ["user", "alert", "meta", "datasets"]) tx.objectStore(s).clear();
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    await new Promise<void>((res, rej) => {
      const tx = db.transaction("datasets", "readwrite");
      const os = tx.objectStore("datasets");
      for (const d of datasets) os.put(d, d.id as DatasetId);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    for (const [store, rows] of [["user", userRows], ["alert", alertRows]] as const) {
      for (let i = 0; i < rows.length; i += BATCH) {
        await new Promise<void>((res, rej) => {
          const tx = db.transaction(store, "readwrite");
          const os = tx.objectStore(store);
          for (const r of rows.slice(i, i + BATCH)) os.put(r);
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
        post({
          phase: "indexing", store,
          pct: 80 + Math.round(Math.min(1, (i + BATCH) / Math.max(1, rows.length)) * 10),
          done: Math.min(rows.length, i + BATCH), total: rows.length,
        });
      }
    }

    const snapshot: CorpusSnapshot = {
      fileName: file.name,
      fileSize: file.size,
      sha256: sha,
      loadedAt: new Date().toISOString(),
      instrument,
      generatedAt,
      asOf: structuralOk ? declaredCutOff : null,
      workbookVerified: structuralOk,
      population,
      sheets: verdicts.map((v) =>
        SHEETS[v.sheet]?.role === "excluded"
          ? { ...v, role: `excluded — ${EXCLUDED_REASON[v.sheet] ?? ""}` }
          : v),
      invariants: results,
      unverifiedDatasets: [...unverified],
      discarded,
    };

    await new Promise<void>((res, rej) => {
      const tx = db.transaction("meta", "readwrite");
      tx.objectStore("meta").put(snapshot, "current");
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();

    post({ phase: "done", snapshot });
  } catch (err) {
    post({ phase: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
