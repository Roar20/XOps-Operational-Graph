"use client";
/**
 * Acceso de LECTURA al corpus en IndexedDB. Lo comparten el cargador y las
 * herramientas de cliente del agente, para que no existan dos versiones de la
 * misma logica que puedan divergir.
 */

export const CORPUS_DB = "xops-corpus";

export type CorpusMeta = {
  as_of: string | null;
  sha256: string;
  instrument: string;
  verified: boolean;
  complete?: boolean;
  rows: { user: number; alert: number };
  file_name?: string;
  loaded_at?: string;
  report?: unknown;
};

/**
 * Abre el corpus SIN crearlo. Es lectura y no debe dejar rastro si no hay nada
 * que leer.
 *
 * La version ingenua, indexedDB.open(DB, 1) resolviendo null en
 * onupgradeneeded, tiene dos fallas verificadas en navegador:
 *
 *  1. Deja la base creada. Resolver null reporta "no hay corpus" pero la
 *     transaccion de version sigue su curso y queda xops-corpus@1 vacia. Cuando
 *     despues la ingesta abre en la version 1, onupgradeneeded ya NO dispara,
 *     asi que no puede crear sus object stores. Basta con que alguien le
 *     pregunte algo al agente antes de cargar el corpus para inutilizarla.
 *  2. Fija la version. Si la ingesta sube a la 2, open(DB, 1) lanza
 *     VersionError y se diria que no hay corpus teniendolo cargado.
 *
 * Por eso: sin fijar version, y si la base no existia se aborta la creacion.
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
        try {
          indexedDB.deleteDatabase(CORPUS_DB);
        } catch {
          /* nada que limpiar */
        }
      }
      resolve(null);
    };
    req.onblocked = () => resolve(null);
  });
}

/** Estado del corpus cargado, o null si este navegador no tiene ninguno. */
export async function readCorpusMeta(): Promise<CorpusMeta | null> {
  const db = await openExisting();
  if (!db) return null;
  const meta = await new Promise<CorpusMeta | null>((resolve) => {
    try {
      const r = db.transaction("meta", "readonly").objectStore("meta").get("current");
      r.onsuccess = () => resolve((r.result as CorpusMeta) ?? null);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  db.close();
  return meta;
}

/** Borra el corpus de este navegador. Lo usa el boton de descarga del cargador. */
export function deleteCorpus(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(false);
    const req = indexedDB.deleteDatabase(CORPUS_DB);
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
    req.onblocked = () => resolve(false);
  });
}
