import type { InvariantClass } from "./contract";

/**
 * El alcance vive en el DATASET, no en el libro.
 *
 * Un mismo libro trae hojas de detalle muestreadas y hojas agregadas que cubren
 * la poblacion entera. Marcar el libro completo como "muestra" borraria esa
 * diferencia justo donde importa: una tasa por grupo calculada sobre
 * User_By_Group describe 277,408 incidentes, y la misma tasa calculada sobre
 * User_Detail describiria 500 filas. La interfaz tiene que poder distinguirlas.
 */
export type Scope = "full" | "sample" | "unknown";

export type Provenance = {
  /** Hoja de la que sale la cifra. */
  sourceSheet: string;
  scope: Scope;
  /** Filas realmente leidas de esa hoja. */
  loadedRows: number;
  /**
   * Poblacion que esas filas representan. En una hoja agregada es la suma de su
   * columna de conteo; en una hoja de detalle muestreada es la poblacion
   * declarada, que NO es lo mismo que lo cargado.
   */
  representedRows: number | null;
  /** Como se calculo. Texto corto, para el panel de metadatos. */
  calculation: string;
  /** Prueba que decidio el alcance, cuando la hubo. */
  scopeEvidence?: string;
};

export type DatasetId =
  | "overview"
  | "userDetail"
  | "userByGroup"
  | "alertDetail"
  | "alertByGroup"
  | "byDecalogue"
  | "decalogueByGroup"
  | "decalogueValidation"
  | "complianceCloseNotes"
  | "complianceAlerts"
  | "dualAxis";

export type Dataset<T = unknown> = {
  id: DatasetId;
  sheet: string;
  present: boolean;
  provenance: Provenance;
  rows: T[];
  /** Bloques clave/valor de las hojas de banner. */
  facts?: Record<string, Record<string, string | number>>;
};

export type InvariantResult = {
  id: string;
  cls: InvariantClass;
  statement: string;
  passed: boolean;
  detail: string;
  guards: string[];
};

export type Population = { total: number | null; user: number | null; alert: number | null };

export type SheetVerdict = {
  sheet: string;
  present: boolean;
  role: string;
  scope: Scope;
  loadedRows: number;
  representedRows: number | null;
  missingColumns: string[];
  extraColumns: string[];
  ok: boolean;
};

export type CorpusSnapshot = {
  fileName: string;
  fileSize: number;
  sha256: string;
  loadedAt: string;
  instrument: string;
  /** Hora en que se genero el reporte, leida de Overview. NO es el corte del dato. */
  generatedAt: string | null;
  /**
   * Corte del dato, solo si el libro lo declara explicitamente. Este corpus no
   * lo declara, de modo que queda nulo y la interfaz lo dice en vez de estampar
   * la hora de generacion como si fuera un corte.
   */
  asOf: string | null;
  /** Las invariantes estructurales pasan: el libro es un corpus QN. */
  workbookVerified: boolean;
  population: Population;
  sheets: SheetVerdict[];
  invariants: InvariantResult[];
  /** Datasets que NO pueden presentarse como verificados, por invariante rota. */
  unverifiedDatasets: string[];
  discarded: { store: string; reason: string; rows: number }[];
};

export type IngestProgress =
  | { phase: "reading"; pct: number }
  | { phase: "parsing"; pct: number; note?: string }
  | { phase: "validating"; pct: number }
  | { phase: "deriving"; pct: number; note?: string }
  | { phase: "indexing"; pct: number; store: string; done: number; total: number }
  | { phase: "done"; snapshot: CorpusSnapshot }
  | { phase: "error"; message: string };
