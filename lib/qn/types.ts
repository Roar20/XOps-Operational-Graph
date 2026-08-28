/** Contrato entre el worker de ingesta y la interfaz de carga. */

export type SheetVerdict = {
  sheet: string;
  present: boolean;
  role: string;
  rowsInFile: number;
  /** Columnas del manifiesto que el archivo no trae. */
  missingColumns: string[];
  /** Columnas del archivo que el manifiesto no declara. No invalidan nada. */
  extraColumns: string[];
  ok: boolean;
};

export type IngestReport = {
  fileName: string;
  fileSize: number;
  sha256: string;
  instrument: string;
  /** El corte SOLO se estampa cuando verified es true. */
  asOf: string | null;
  /**
   * La estructura cuadra con el manifiesto: hojas, contrato de columnas y las
   * invariantes que se pueden comprobar sobre el archivo subido.
   */
  verified: boolean;
  /**
   * La poblacion del archivo iguala la declarada en el manifiesto. Un archivo
   * de muestra es verified pero NO complete: la estructura es la del corpus,
   * el volumen no.
   */
  complete: boolean;
  sheets: SheetVerdict[];
  /** Filas indexadas por store, y las descartadas con su razon. */
  indexed: { user: number; alert: number };
  declared: { user: number; alert: number; total: number };
  discarded: { store: string; reason: string; rows: number }[];
  failures: string[];
  warnings: string[];
};

export type IngestProgress =
  | { phase: "reading"; pct: number }
  | { phase: "parsing"; pct: number; note?: string }
  | { phase: "validating"; pct: number }
  | { phase: "indexing"; pct: number; store: string; done: number; total: number }
  | { phase: "done"; report: IngestReport }
  | { phase: "error"; message: string };

/** Normalizador canonico de Assignment Group. Igual en build, worker y app. */
export const agKey = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
