/**
 * Contrato del corpus QN v2.4.2, en codigo.
 *
 * Vive aqui y no en un JSON generado, porque la aplicacion no debe depender de
 * un paso previo de proyeccion: el libro que se sube es la fuente de verdad. Lo
 * que este archivo declara es la FORMA esperada, nunca las cifras. Ninguna
 * poblacion esta escrita aqui: se leen de la hoja Overview del libro.
 *
 * scripts/build_qn_aggregates.py sigue existiendo como utilidad de depuracion,
 * y lee este mismo contrato conceptual. No es requisito para que la app corra.
 */

export type SheetRole =
  /** Tabla agregada. Puede representar el corpus completo aunque el libro traiga detalle muestreado. */
  | "aggregate"
  /** Grano de ticket. En este corpus llega muestreado salvo prueba en contrario. */
  | "detail"
  /** Titulo, bloques clave/valor y sub-tablas. Sin encabezado tabular unico. */
  | "banner"
  /** Fuera del proyector por decision tomada, no por falta de dato. */
  | "excluded";

export type SheetSpec = {
  role: SheetRole;
  /** Columnas exigidas. Vacio en las hojas de banner, que no tienen encabezado. */
  columns: string[];
  /**
   * Como se prueba que esta hoja cubre la poblacion completa. Si el libro no
   * satisface la prueba, la hoja se marca como muestra y sus cifras se rotulan
   * asi hasta la interfaz. Nunca se asume "full".
   */
  fullIf?: {
    /** Columna que se suma. `__rowcount__` cuenta filas. */
    sumColumn: string;
    /** Contra que cifra declarada en Overview se compara. */
    against: "user" | "alert" | "total";
  };
  /**
   * Alternativa: la hoja declara su propia poblacion adentro. Si esa cifra
   * coincide con la de Overview, la hoja se computo sobre el corpus completo.
   * `label` es la etiqueta a buscar en sus bloques clave/valor, o "__totalRow__"
   * para leer la fila Total de una hoja tabular.
   */
  fullIfDeclares?: { label: string; against: "user" | "alert" | "total" };
};

/**
 * La hoja Overview declara la poblacion. Estas son las etiquetas que se buscan
 * en su columna A; el valor sale del libro, nunca de aqui.
 */
export const POPULATION_KEYS = {
  total: "Total incidents",
  user: "User incidents (scored)",
  alert: "Incident alerts (classified)",
} as const;

export const SHEETS: Record<string, SheetSpec> = {
  Overview: { role: "banner", columns: [] },

  User_Detail: {
    role: "detail",
    columns: [
      "Number", "Assignment Group", "Assigned To", "State", "Priority",
      "Service Offering", "Short Description", "Total Score", "Label",
      "Root Cause", "Resolution Docs", "Description Qlty", "WN Completeness",
      "Lang & Prof", "Noise Ratio", "Human Notes #", "Note Chars",
      "Has Close Notes", "Close Code", "U Close Code", "Reopen Count",
      "Decalogue Primary", "Decalogue All", "Discernment", "Feedback",
      "Decalogue Primary v2", "Decalogue All v2", "Discernment v2",
      "Decalogue Count v2", "Year", "Month", "Category", "Subcategory",
      "compliance_class", "has_rca_marker", "is_template_match", "Closed At",
    ],
    /* El detalle tambien se somete a la prueba: si un libro trajera las 277,408
       filas, se marcaria full y dejaria de rotularse como muestra. */
    fullIf: { sumColumn: "__rowcount__", against: "user" },
  },

  User_By_Group: {
    role: "aggregate",
    columns: [
      "Assignment Group", "Incidents", "Avg Score", "Avg Root Cause",
      "Avg Resolution", "Avg Description", "Avg WN Complete", "Avg Lang & Prof",
      "Avg Noise", "Close Notes %", "Excellent", "Good", "Poor", "Critical",
    ],
    fullIf: { sumColumn: "Incidents", against: "user" },
  },

  User_By_Agent: {
    role: "excluded",
    columns: [
      "Assigned To", "Assignment Group", "Incidents", "Avg Score",
      "Avg Root Cause", "Avg Resolution", "Avg WN Complete", "Avg Noise",
      "Excellent", "Good", "Poor", "Critical",
    ],
  },

  By_Decalogue: {
    role: "aggregate",
    /* El bloque Summary declara "Classified incidents | 35,814 / 277,408": el
       denominador esta ahi, asi que la hoja se puede probar contra Overview. */
    fullIfDeclares: { label: "__decalogueDenominator__", against: "user" },
    columns: [
      "Code", "Pattern", "Discernment", "Incidents", "Avg Score",
      "Close Notes %", "Excellent", "Good", "Poor", "Critical",
    ],
    /* A proposito SIN fullIf: la columna Incidents NO suma la poblacion, porque
       un incidente puede llevar varios codigos. Ver DECALOGUE_MEASURES. */
  },

  Decalogue_By_Group: {
    role: "aggregate",
    columns: ["Assignment Group", "Code", "Pattern", "Incidents", "Avg Score"],
  },

  Decalogue_Validation: {
    role: "banner", columns: [],
    fullIfDeclares: { label: "Total user incidents", against: "user" },
  },
  Compliance_CloseNotes: {
    role: "banner", columns: [],
    fullIfDeclares: { label: "Total user incidents", against: "user" },
  },
  Compliance_Alerts: {
    role: "banner", columns: [],
    fullIfDeclares: { label: "Total alerts", against: "alert" },
  },

  Alert_Detail: {
    role: "detail",
    columns: [
      "Number", "Assignment Group", "Assigned To", "State", "Priority",
      "Service Offering", "Short Description", "Ops Classification",
      "Intervention Level", "Auto-Resolved", "Has Root Cause", "Has Steps",
      "Human Notes #", "Substantive Chars", "Noise Ratio", "Unique Authors",
      "Closed At",
    ],
    fullIf: { sumColumn: "__rowcount__", against: "alert" },
  },

  Alert_By_Group: {
    role: "aggregate",
    columns: [
      "Assignment Group", "Alerts", "Auto-Resolved", "Auto-Resolved %",
      "Has Root Cause", "Has Steps", "Avg Noise", "Avg Substantive Chars",
      "None", "Minimal", "Moderate", "Substantive",
    ],
    fullIf: { sumColumn: "Alerts", against: "alert" },
  },

  Dual_Axis: {
    role: "aggregate",
    fullIfDeclares: { label: "__totalRow__", against: "user" },
    columns: [
      "Label (Axis 1 — process)", "DIAGNOSTICO (n)", "SUSTANTIVO (n)",
      "FORMAL_ONLY (n)", "EMPTY (n)", "Total", "DIAGNOSTICO (row %)",
      "SUSTANTIVO (row %)", "FORMAL_ONLY (row %)", "EMPTY (row %)",
    ],
  },
};

export const EXCLUDED_REASON: Record<string, string> = {
  User_By_Agent:
    "Per-agent quality is out of scope by decision. Measuring named vendor staff " +
    "requires an HR and Legal decision that has not been taken.",
};

/**
 * By_Decalogue publica DOS medidas distintas y la interfaz no debe confundirlas.
 * Un incidente puede llevar varios codigos, por lo tanto la suma de ocurrencias
 * excede a los incidentes clasificados. No es un aviso: son dos unidades.
 */
export const DECALOGUE_MEASURES = {
  classifiedIncidents: {
    label: "Classified incidents",
    unit: "incident",
    note: "Distinct incidents carrying at least one Decalogue code.",
  },
  codeOccurrences: {
    label: "Decalogue occurrences",
    unit: "occurrence",
    note: "Sum of the Incidents column across codes. An incident with two codes counts twice.",
  },
} as const;

/** Las tres clases de invariante. El usuario ve la clase, no solo el id. */
export type InvariantClass = "structural" | "population" | "semantic";

export type InvariantSpec = {
  id: string;
  cls: InvariantClass;
  statement: string;
  /** Que metricas dejan de poder presentarse como verificadas si esta rompe. */
  guards: string[];
};

export const INVARIANTS: InvariantSpec[] = [
  { id: "QN01", cls: "structural", statement: "Every sheet the contract names is present.", guards: ["*"] },
  { id: "QN02", cls: "structural", statement: "Each tabular sheet carries the columns the contract names.", guards: ["*"] },
  { id: "QN03", cls: "population", statement: "User_By_Group sums to the user population Overview declares.", guards: ["userByGroup"] },
  { id: "QN04", cls: "population", statement: "Alert_By_Group sums to the alert population Overview declares.", guards: ["alertByGroup"] },
  { id: "QN05", cls: "population", statement: "User and alert populations partition the total with no overlap.", guards: ["overview"] },
  { id: "QN06", cls: "population", statement: "The Dual_Axis Total row equals the user population.", guards: ["dualAxis"] },
  { id: "QN07", cls: "population", statement: "Each Dual_Axis class column sums to its Total row.", guards: ["dualAxis"] },
  { id: "QN08", cls: "semantic", statement: "By_Decalogue carries ten distinct codes, and occurrences exceed classified incidents.", guards: ["byDecalogue"] },
  { id: "QN09", cls: "semantic", statement: "The v1/v2 classifier validation is present, so the cross-cut series stays blocked.", guards: ["decalogueValidation"] },
  { id: "QN10", cls: "structural", statement: "No assignment group name repeats inside User_By_Group.", guards: ["userByGroup"] },
  { id: "QN11", cls: "semantic", statement: "The canonical normalizer collapses no group: one name, one key.", guards: ["userByGroup", "alertByGroup"] },
  { id: "QN12", cls: "semantic", statement: "The close-notes KPI carries its target, never the rate alone.", guards: ["complianceCloseNotes"] },
  { id: "QN13", cls: "semantic", statement: "No opened_at column exists, so time-to-resolve stays blocked.", guards: ["mttr"] },
];

/** Normalizador canonico de Assignment Group. Igual en worker, app y proyector. */
export const agKey = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
