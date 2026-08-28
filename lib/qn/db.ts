"use client";
/**
 * Acceso de LECTURA al corpus en IndexedDB. Lo comparten el cargador, las
 * pantallas de analisis y las herramientas del agente, para que no existan dos
 * versiones de la misma logica que puedan divergir.
 */
import type { CorpusSnapshot, Dataset, DatasetId } from "./types";

export const CORPUS_DB = "xops-corpus";

/**
 * Abre el corpus SIN crearlo. Es lectura y no debe dejar rastro si no hay nada
 * que leer.
 *
 * La version ingenua, indexedDB.open(DB, N) resolviendo null en
 * onupgradeneeded, tiene dos fallas verificadas en navegador:
 *
 *  1. Deja la base creada. Resolver null reporta "no hay corpus" pero la
 *     transaccion de version sigue su curso y queda la base vacia. Cuando
 *     despues la ingesta abre en esa misma version, onupgradeneeded ya NO
 *     dispara, asi que no puede crear sus object stores.
 *  2. Fija la version. Si la ingesta sube de version, open con la anterior
 *     lanza VersionError y se diria que no hay corpus teniendolo cargado.
 */
export function openExisting(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);

    let creating = false;
    const req = indexedDB.open(CORPUS_DB);

    req.onupgradeneeded = () => {
      creating = true;
      try {
        req.transaction?.abort();
      } catch {
        /* el abort ya deja la base sin escribir */
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      if (creating || !db.objectStoreNames.contains("meta")) {
        db.close();
        return resolve(null);
      }
      resolve(db);
    };
    req.onerror = () => {
      if (creating) {
        try { indexedDB.deleteDatabase(CORPUS_DB); } catch { /* nada que limpiar */ }
      }
      resolve(null);
    };
    req.onblocked = () => resolve(null);
  });
}

function get<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const r = db.transaction(store, "readonly").objectStore(store).get(key);
      r.onsuccess = () => resolve((r.result as T) ?? null);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Estado del corpus cargado, o null si este navegador no tiene ninguno. */
export async function readSnapshot(): Promise<CorpusSnapshot | null> {
  const db = await openExisting();
  if (!db) return null;
  const snap = await get<CorpusSnapshot>(db, "meta", "current");
  db.close();
  return snap;
}

/** Snapshot y datasets en una sola apertura: es lo que consume el proveedor. */
export async function readCorpus(): Promise<{
  snapshot: CorpusSnapshot;
  datasets: Partial<Record<DatasetId, Dataset>>;
} | null> {
  const db = await openExisting();
  if (!db) return null;
  const snapshot = await get<CorpusSnapshot>(db, "meta", "current");
  if (!snapshot) { db.close(); return null; }

  const datasets = await new Promise<Partial<Record<DatasetId, Dataset>>>((resolve) => {
    const out: Partial<Record<DatasetId, Dataset>> = {};
    try {
      const req = db.transaction("datasets", "readonly").objectStore("datasets").openCursor();
      req.onsuccess = () => {
        const cur = (req as IDBRequest<IDBCursorWithValue>).result;
        if (!cur) return resolve(out);
        out[cur.key as DatasetId] = cur.value as Dataset;
        cur.continue();
      };
      req.onerror = () => resolve(out);
    } catch {
      resolve(out);
    }
  });
  db.close();
  return { snapshot, datasets };
}

/** Borra el corpus de este navegador. */
export function deleteCorpus(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(false);
    const req = indexedDB.deleteDatabase(CORPUS_DB);
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
    req.onblocked = () => resolve(false);
  });
}
