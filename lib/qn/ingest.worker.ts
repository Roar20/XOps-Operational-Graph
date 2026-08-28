/// <reference lib="webworker" />
/**
 * Ingesta del corpus QN en el navegador.
 *
 * Corre en un Web Worker porque el libro completo trae 719,946 filas de detalle
 * y parsearlo en el hilo principal congela la pantalla. Nada de esto sube a un
 * servidor: el detalle se queda en IndexedDB, en la maquina de quien lo carga.
 *
 * EL VALIDADOR ES UN PORTERO, NO UN ADORNO
 * Las ocho pantallas estampan la fecha de corte como afirmacion respaldada por
 * invariantes que corren en build. Si alguien arrastra un archivo y la app
 * renderiza lo que ese archivo diga, el sello pasa a ser una afirmacion sobre
 * un archivo que nadie verifico. Por eso se compara contra
 * data/QN_v242_contract.json ANTES de escribir una sola fila, y si no cuadra la
 * app declara corpus sin verificar y se niega a estampar el corte.
 *
 * Dos veredictos distintos, a proposito:
 *   verified  la estructura es la del corpus (hojas y columnas del manifiesto)
 *   complete  ademas el volumen iguala la poblacion declarada
 * Un archivo de muestra es verified pero no complete. Se indexa y se usa, con
 * sus cifras rotuladas como muestra: no se descarta ni se presenta como corpus.
 */
import * as XLSX from "xlsx";
import contract from "@/data/QN_v242_contract.json";
import { agKey, type IngestProgress, type IngestReport, type SheetVerdict } from "./types";

const DB = "xops-corpus";
const VERSION = 1;
const BATCH = 2000;

type Row = Record<string, unknown>;

const post = (m: IngestProgress) => (self as unknown as Worker).postMessage(m);

async function sha256(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Crea el esquema que lib/agent/client-tools.ts espera encontrar.
 *
 * Sobre "Ops Classification": el contrato original pedia un indice con ese
 * keyPath, y NO es implementable. Un keyPath de IndexedDB tiene que ser una
 * ruta de identificadores, de modo que un nombre con espacio lo rechaza con
 * "The keyPath argument contains an invalid key path". Por eso cada fila de
 * alerta lleva ops_class precomputado y el indice va sobre ese campo. La
 * columna original se conserva intacta en la fila.
 *
 * Los errores de onupgradeneeded se capturan a mano: si se dejan escapar, la
 * promesa no resuelve ni rechaza y la carga se cuelga sin decir nada.
 */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      try {
        const db = req.result;
        for (const s of ["meta", "user", "alert"]) {
          if (db.objectStoreNames.contains(s)) db.deleteObjectStore(s);
        }
        db.createObjectStore("meta");
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

function putBatch(db: IDBDatabase, store: string, rows: Row[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    for (const r of rows) os.put(r);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Encabezado real de una hoja, leido de la primera fila. */
function headerOf(ws: XLSX.WorkSheet): string[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, range: 0 });
  const first = (rows[0] ?? []) as unknown[];
  return first.map((c) => String(c ?? "").trim());
}

self.onmessage = async (e: MessageEvent<{ file: File }>) => {
  try {
    const file = e.data.file;
    post({ phase: "reading", pct: 5 });
    const buf = await file.arrayBuffer();
    const sha = await sha256(buf);

    post({ phase: "parsing", pct: 15, note: "abriendo el libro" });
    const wb = XLSX.read(buf, { type: "array", cellDates: false, dense: true });

    /* ---------- validacion contra el manifiesto ---------- */
    post({ phase: "validating", pct: 35 });
    const spec = contract.sheets as Record<string, { columns: string[]; role: string }>;
    const failures: string[] = [];
    const warnings: string[] = [];
    const sheets: SheetVerdict[] = [];

    for (const [name, s] of Object.entries(spec)) {
      const present = wb.SheetNames.includes(name);
      const ws = present ? wb.Sheets[name] : null;
      const banner = s.role === "banner";
      const hdr = ws && !banner ? headerOf(ws) : [];
      const missing = banner ? [] : s.columns.filter((c) => !hdr.includes(c));
      const extra = banner ? [] : hdr.filter((c) => c && !s.columns.includes(c));
      const rowsInFile = ws
        ? Math.max(0, (XLSX.utils.decode_range(ws["!ref"] ?? "A1:A1").e.r ?? 0) - (banner ? 0 : 0))
        : 0;
      const ok = present && missing.length === 0;
      sheets.push({ sheet: name, present, role: s.role, rowsInFile, missingColumns: missing, extraColumns: extra, ok });

      if (!present) failures.push(`Sheet ${name} is missing.`);
      else if (missing.length) failures.push(`${name}: ${missing.length} column${missing.length === 1 ? "" : "s"} from the contract absent (${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}).`);
      if (extra.length) warnings.push(`${name}: ${extra.length} column${extra.length === 1 ? "" : "s"} the manifest does not declare. They are not read.`);
    }

    /* Sin las dos hojas de detalle no hay nada que indexar: eso si es fatal. */
    const fatal = !wb.SheetNames.includes("User_Detail") || !wb.SheetNames.includes("Alert_Detail");
    if (fatal) {
      post({
        phase: "error",
        message:
          "The file carries no User_Detail and no Alert_Detail. Without both detail sheets there is no corpus " +
          "to index, and nothing was written to this browser.",
      });
      return;
    }

    const verified = failures.length === 0;

    /* ---------- lectura del detalle ---------- */
    post({ phase: "parsing", pct: 50, note: "leyendo User_Detail" });
    const userRaw = XLSX.utils.sheet_to_json<Row>(wb.Sheets["User_Detail"], { defval: null, blankrows: false });
    post({ phase: "parsing", pct: 65, note: "leyendo Alert_Detail" });
    const alertRaw = XLSX.utils.sheet_to_json<Row>(wb.Sheets["Alert_Detail"], { defval: null, blankrows: false });

    /* Una fila sin Number no se puede indexar: keyPath es Number. Se descarta y
       se dice cuantas y por que, en vez de dejarlas caer en silencio. */
    const discarded: IngestReport["discarded"] = [];
    const prep = (rows: Row[], store: string) => {
      const seen = new Set<string>();
      const out: Row[] = [];
      let noNumber = 0, dup = 0;
      for (const r of rows) {
        const num = String(r["Number"] ?? "").trim();
        if (!num) { noNumber++; continue; }
        if (seen.has(num)) { dup++; continue; }
        seen.add(num);
        const row: Row = { ...r, Number: num, ag_key: agKey(r["Assignment Group"]) };
        /* El indice no puede ir sobre "Ops Classification" por el espacio en el
           nombre, asi que se replica en un campo con keyPath valido. */
        if (store === "alert") row.ops_class = r["Ops Classification"] ?? null;
        out.push(row);
      }
      if (noNumber) discarded.push({ store, reason: "no Number: cannot be indexed", rows: noNumber });
      if (dup) discarded.push({ store, reason: "Number repeated inside the file", rows: dup });
      return out;
    };
    const user = prep(userRaw, "user");
    const alert = prep(alertRaw, "alert");

    /* ---------- escritura ---------- */
    const db = await openDb();
    /* Un corpus nuevo reemplaza al anterior. Mezclar dos cortes en el mismo
       store produciria cifras que no pertenecen a ninguna fecha. */
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(["user", "alert", "meta"], "readwrite");
      tx.objectStore("user").clear();
      tx.objectStore("alert").clear();
      tx.objectStore("meta").clear();
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });

    for (const [store, rows] of [["user", user], ["alert", alert]] as const) {
      for (let i = 0; i < rows.length; i += BATCH) {
        await putBatch(db, store, rows.slice(i, i + BATCH));
        post({
          phase: "indexing",
          pct: 70 + Math.round(((store === "user" ? 0 : 0.5) + Math.min(1, (i + BATCH) / Math.max(1, rows.length)) * 0.5) * 30),
          store,
          done: Math.min(rows.length, i + BATCH),
          total: rows.length,
        });
      }
    }

    const declared = contract.declared_population as { total: number; user_detail: number; alert_detail: number };
    const complete = user.length === declared.user_detail && alert.length === declared.alert_detail;
    if (verified && !complete) {
      warnings.push(
        `The file carries ${user.length.toLocaleString("en-US")} of ${declared.user_detail.toLocaleString("en-US")} ` +
        `user incidents and ${alert.length.toLocaleString("en-US")} of ${declared.alert_detail.toLocaleString("en-US")} ` +
        `alerts. The structure is the corpus, the volume is not: this is a sample and its figures are labelled as one.`,
      );
    }

    const report: IngestReport = {
      fileName: file.name,
      fileSize: file.size,
      sha256: sha,
      instrument: contract.instrument,
      asOf: verified ? contract.as_of : null,
      verified,
      complete,
      sheets,
      indexed: { user: user.length, alert: alert.length },
      declared: { user: declared.user_detail, alert: declared.alert_detail, total: declared.total },
      discarded,
      failures,
      warnings,
    };

    await new Promise<void>((res, rej) => {
      const tx = db.transaction("meta", "readwrite");
      tx.objectStore("meta").put(
        {
          as_of: report.asOf,
          sha256: sha,
          instrument: contract.instrument,
          verified,
          complete,
          rows: { user: user.length, alert: alert.length },
          file_name: file.name,
          loaded_at: new Date().toISOString(),
          report,
        },
        "current",
      );
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();

    post({ phase: "done", report });
  } catch (err) {
    post({ phase: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
