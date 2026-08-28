/**
 * Modelo de relaciones del grafo operativo.
 *
 * REGLA DURA DEL PRODUCTO: el sistema nunca sube de nivel la evidencia en
 * silencio. Una relacion compartida no es atribucion ambigua. Una asociacion no
 * es causalidad. Una relacion derivada no es una relacion declarada. Una
 * muestra no es una poblacion. Una cifra del business case no es una cifra
 * reproducida del corpus cargado. Una medida no disponible no se estima salvo
 * que se defina explicitamente el metodo.
 *
 * Los tipos de este archivo existen para que esa regla sea imposible de romper
 * por descuido: ningun valor analitico viaja sin su estado de evidencia.
 */

/* ------------------------------------------------------------------ */
/* Estado de evidencia de una RELACION                                 */
/* ------------------------------------------------------------------ */

export type RelationshipStatus =
  /** Existe explicitamente en la fuente autoritativa. */
  | "declared"
  /** Reproducible por traversal determinista sobre relaciones declaradas. */
  | "derived"
  /** Varias senales independientes convergen; no hay relacion directa autoritativa. */
  | "corroborated"
  /** Un metodo analitico propone candidatos. Nunca se convierte en declared solo. */
  | "inferred"
  /** La evidencia disponible no sostiene ningun candidato creible. */
  | "unknown"
  /** Dos fuentes autoritativas se contradicen. Se expone, no se resuelve. */
  | "conflict";

/** Fuerza de una pieza de evidencia. Ordinal, no probabilistica. */
export type EvidenceStrength = "authoritative" | "strong" | "moderate" | "weak";

export interface EvidenceItem {
  /** De donde sale: hoja, campo, dataset. */
  source: string;
  /** Como se obtuvo: traversal, exact-match, frequency, embedding, llm… */
  method: string;
  strength: EvidenceStrength;
  /** Detalle legible: el match, la ruta, el conteo. */
  detail?: string;
}

export interface RelationshipEdge {
  from: string;
  to: string;
  type: RelationshipType;
  status: RelationshipStatus;
  evidence: EvidenceItem[];
  /**
   * Puntaje de evidencia, NO probabilidad. Ninguno de los metodos disponibles
   * hoy produce una probabilidad calibrada, de modo que llamarlo confianza
   * seria subir de nivel la evidencia. Escala 0..1, ordenable, no interpretable
   * como "82% de probabilidad".
   */
  evidenceScore?: number;
  requiresConfirmation: boolean;
}

export type RelationshipType =
  | "application->platform"
  | "application->support_group"
  | "application->business_process"
  | "application->owner"
  | "platform->application"
  | "incident->application";

/* ------------------------------------------------------------------ */
/* Procedencia de un VALOR analitico                                   */
/* ------------------------------------------------------------------ */

export type ValueOrigin =
  /** Contado directamente sobre el modelo cargado. */
  | "measured"
  /** Calculado por traversal determinista sobre el modelo cargado. */
  | "derived"
  /** Cifra del business case. NO reproducida del corpus. Nunca se mezcla. */
  | "business_case_baseline"
  /** El dato necesario no esta cargado. No se estima. */
  | "unavailable";

export interface Measured<T> {
  value: T;
  origin: ValueOrigin;
  /** Dataset y campo de los que sale. */
  source: string;
  /** Denominador contra el que se lee, cuando aplica. R3. */
  denominator?: number;
  /** Como se calculo, en una linea. */
  calculation?: string;
  /** Solo para origin = "unavailable": que falta para poder calcularlo. */
  missingEvidence?: string[];
}

/* ------------------------------------------------------------------ */
/* Capa 1 · RUTEO DE RELACIONES  (computable hoy)                      */
/* ------------------------------------------------------------------ */

/**
 * Estado de la relacion de soporte declarada de una aplicacion.
 *
 * Los nombres dicen exactamente lo que el dato prueba y nada mas. Compartir un
 * grupo de soporte NO prueba que la atribucion de incidentes sea ambigua: puede
 * haber Configuration Item, Service Offering, Business Application en el
 * ticket, u otras senales que resuelvan el caso. Lo unico probado aqui es si la
 * relacion de soporte declarada, POR SI SOLA, produce una ruta unica.
 */
export type SupportRouteState =
  /** Tiene al menos un grupo que no comparte con ninguna otra aplicacion. */
  | "unique_support_route"
  /** Tiene grupos, pero todos los comparte con otras aplicaciones. */
  | "shared_support_route"
  /** No hay relacion de soporte declarada. */
  | "no_declared_support_route";

export interface ApplicationRelationshipState {
  appId: string;
  name: string;
  apm: string | null;

  platforms: string[];
  supportGroups: string[];
  /** Claves canonicas de los grupos, para unir con el corpus. */
  supportGroupKeys: string[];

  supportRoute: SupportRouteState;
  /** Grupos exclusivos de esta aplicacion. Vacio si comparte todos. */
  exclusiveGroups: string[];
  /** Cuantas aplicaciones compiten por el grupo mas disputado. */
  maxContenders: number;

  /** Tipos de relacion que esta aplicacion no declara. */
  missingRelationshipTypes: RelationshipType[];
  /** Quien podria confirmarlas, si el modelo lo declara. Nunca inventado. */
  declaredOwners: { dpm: string | null; owner: string | null; techLead: string | null };

  provenance: EvidenceItem[];
}

export interface GroupTopology {
  name: string;
  key: string;
  appIds: string[];
  appCount: number;
  /** Sirve a mas de una aplicacion. */
  isShared: boolean;
}

export interface PlatformTopology {
  name: string;
  /** Aplicaciones que declaran la plataforma. Relacion declarada. */
  directAppIds: string[];
  /** Grupos de soporte que sirven a esas aplicaciones. Traversal paso 1. */
  bridgingGroupKeys: string[];
  /** Aplicaciones alcanzables por esos grupos, excluidas las directas. Paso 2. */
  secondOrderAppIds: string[];
  /**
   * Semantica del traversal, escrita: platform -> apps declaradas -> sus grupos
   * de soporte -> todas las apps que esos grupos sirven. Un salto. Sin pesos.
   */
  traversal: string;
}

export interface RelationshipCoverage {
  type: RelationshipType;
  known: number;
  missing: number;
  derived: number;
  universe: number;
  /** Que preguntas quedan bloqueadas mientras falte. */
  blocks: string[];
}

/* ------------------------------------------------------------------ */
/* Capa 2 · ATRIBUCION DE INCIDENTES  (requiere evidencia que no hay)  */
/* ------------------------------------------------------------------ */

/**
 * Capa separada a proposito. El ruteo de relaciones es evidencia de portafolio;
 * la atribucion de incidentes exige evidencia incidente-a-aplicacion. La una no
 * sustituye a la otra, y el producto no debe presentarlas como la misma medida.
 */
export interface IncidentAttributionLayer {
  available: boolean;
  ambiguousShare: Measured<number | null>;
  medianTimeToResolve: Measured<null>;
  missingEvidence: string[];
  /** Que se podria responder el dia que llegue el extracto. */
  unlocks: string[];
}

/* ------------------------------------------------------------------ */
/* Reconciliacion contra el business case                              */
/* ------------------------------------------------------------------ */

export type ReconciliationState =
  /** Coincide con la cifra del business case dentro de la tolerancia. */
  | "matches"
  /** Difieren y la causa esta identificada. */
  | "diverges"
  /** No se puede calcular con el dato cargado. */
  | "not_computable";

export interface ReconciliationItem {
  claim: string;
  businessCase: number | null;
  measured: number | null;
  state: ReconciliationState;
  /** Por que difieren, o que falta para calcularlo. Nunca se elige un ganador. */
  note: string;
}

/* ------------------------------------------------------------------ */
/* Inventario de senales para descubrimiento de relaciones             */
/* ------------------------------------------------------------------ */

export interface SignalInventoryRow {
  relationship: RelationshipType;
  availableSignals: string[];
  deterministicPath: string | null;
  alternativePaths: string[];
  aiMethod: string | null;
  strength: EvidenceStrength;
  /** Se puede validar con lo que hay cargado hoy. */
  validatableToday: boolean;
  missingData: string[];
}
