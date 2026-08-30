import type { EvidencePack, StructuredAnswer } from "./types";

/**
 * v1 provenance is one thing: every app_id the model returns must appear
 * literally in the pack it was given. If the model invents an id the answer
 * is discarded — we never return polluted content to the caller.
 */
export type ProvenanceViolation =
  | { kind: "unknown_finding_app_id"; app_id: string; index: number }
  | {
      kind: "unknown_evidence_app_id";
      app_id: string;
      finding_index: number;
    };

export function verifyProvenance(
  answer: StructuredAnswer,
  pack: EvidencePack,
): ProvenanceViolation[] {
  const allowed = new Set(pack.applications.map((a) => a.app_id));
  const violations: ProvenanceViolation[] = [];
  answer.findings.forEach((f, i) => {
    if (!allowed.has(f.app_id)) {
      violations.push({
        kind: "unknown_finding_app_id",
        app_id: f.app_id,
        index: i,
      });
    }
    for (const ev of f.evidence) {
      if (!allowed.has(ev)) {
        violations.push({
          kind: "unknown_evidence_app_id",
          app_id: ev,
          finding_index: i,
        });
      }
    }
  });
  return violations;
}
