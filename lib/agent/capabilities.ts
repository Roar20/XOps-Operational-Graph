/**
 * Ask XOps capability metadata. Single source of truth for what is shown in
 * the drawer home. Pure data — kept out of the client component so a plain
 * unit test can assert the evidence-source contract without a React runtime.
 *
 * Contract enforced by the tests in this module:
 *  - Exactly one capability is fully "available" (Portfolio Risk).
 *  - Exactly one capability is in "beta" (Operational Health).
 *  - Portfolio Risk declares Semantic Layer evidence and never QN.
 *  - Operational Health declares QN Operational Corpus evidence.
 *  - The remaining three capabilities are visible but "coming_next" (no
 *    backend, no click-through).
 */

export type CapabilityId =
  | "portfolio_risk"
  | "operational_health"
  | "evidence_gaps"
  | "blast_radius"
  | "rca_intelligence";

export type CapabilityStatus = "available" | "beta" | "coming_next";

export type CapabilityMeta = {
  id: CapabilityId;
  label: string;
  question: string;
  description: string;
  evidence: string;
  status: CapabilityStatus;
};

export const CAPABILITIES: CapabilityMeta[] = [
  {
    id: "portfolio_risk",
    label: "Portfolio Risk",
    question: "What needs attention first, and why?",
    description:
      "Prioritize applications using business, operational, and evidence signals.",
    evidence: "Semantic Layer",
    status: "available",
  },
  {
    id: "operational_health",
    label: "Operational Health",
    question: "Where is operational pressure building?",
    description:
      "Understand where incidents and alerts are concentrating and where operational signals may require attention.",
    evidence: "QN Operational Corpus",
    status: "beta",
  },
  {
    id: "evidence_gaps",
    label: "Evidence Gaps",
    question: "Where are decisions limited by missing evidence?",
    description:
      "Identify decisions blocked by insufficient evidence in the semantic layer or the operational corpus.",
    evidence: "Semantic Layer + QN Operational Corpus",
    status: "coming_next",
  },
  {
    id: "blast_radius",
    label: "Blast Radius",
    question: "What could be impacted if something fails?",
    description:
      "Map downstream impact of an application through the semantic layer relationships.",
    evidence: "Semantic Layer",
    status: "coming_next",
  },
  {
    id: "rca_intelligence",
    label: "RCA Intelligence",
    question: "What appears to be driving an operational issue?",
    description:
      "Synthesize likely operational drivers from work notes and incident patterns.",
    evidence: "QN Operational Corpus",
    status: "coming_next",
  },
];
