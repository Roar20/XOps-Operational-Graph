"use client";
/**
 * Proveedor del corpus cargado. Una sola lectura de IndexedDB, compartida por
 * todas las pantallas de analisis.
 *
 * Regla de autoridad: cada metrica se pide al dataset de mayor autoridad que
 * exista en el libro. Una tasa por grupo sale de User_By_Group, que cubre la
 * poblacion; no se recalcula desde las filas de detalle, que llegan muestreadas.
 * El acceso devuelve SIEMPRE la procedencia junto al valor, de modo que la
 * interfaz no pueda mostrar la cifra sin saber que describe.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readCorpus, deleteCorpus } from "./db";
import type { CorpusSnapshot, Dataset, DatasetId, Provenance, Scope } from "./types";

export type Measured<T> = { value: T; provenance: Provenance };

type Ctx = {
  ready: boolean;
  snapshot: CorpusSnapshot | null;
  datasets: Partial<Record<DatasetId, Dataset>>;
  reload: () => Promise<void>;
  clear: () => Promise<void>;
};

const CorpusCtx = createContext<Ctx>({
  ready: false, snapshot: null, datasets: {},
  reload: async () => {}, clear: async () => {},
});

export function CorpusProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ snapshot: CorpusSnapshot | null; datasets: Partial<Record<DatasetId, Dataset>> }>(
    { snapshot: null, datasets: {} },
  );
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const c = await readCorpus();
    setState(c ?? { snapshot: null, datasets: {} });
    setReady(true);
  }, []);

  const clear = useCallback(async () => {
    await deleteCorpus();
    setState({ snapshot: null, datasets: {} });
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const value = useMemo<Ctx>(
    () => ({ ready, snapshot: state.snapshot, datasets: state.datasets, reload, clear }),
    [ready, state, reload, clear],
  );
  return <CorpusCtx.Provider value={value}>{children}</CorpusCtx.Provider>;
}

export const useCorpus = () => useContext(CorpusCtx);

/**
 * Un dataset con su veredicto de verificacion ya aplicado. Si una invariante
 * que lo protege fallo, llega marcado y la interfaz no puede presentarlo como
 * verificado: no se repara en silencio.
 */
export function useDataset(id: DatasetId) {
  const { snapshot, datasets, ready } = useCorpus();
  const ds = datasets[id];
  const unverified = !!snapshot?.unverifiedDatasets.includes(id);
  return {
    ready,
    present: !!ds?.present,
    rows: ds?.rows ?? [],
    facts: ds?.facts ?? {},
    provenance: ds?.provenance ?? null,
    scope: (ds?.provenance.scope ?? "unknown") as Scope,
    verified: !!snapshot?.workbookVerified && !unverified,
  };
}

/** Etiqueta corta de alcance, la que va junto a la cifra. */
export const scopeLabel = (s: Scope) =>
  s === "full" ? "Full corpus" : s === "sample" ? "Sample" : "Scope unknown";

export const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const m = v.trim().replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

export const fmt = (n: number | null | undefined) =>
  n == null ? "Not calculated" : n.toLocaleString("en-US");
