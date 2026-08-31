import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CAPABILITIES } from "@/lib/agent/capabilities";

describe("Ask XOps capability catalog", () => {
  it("lists exactly the five expected capability ids in order", () => {
    assert.deepEqual(
      CAPABILITIES.map((c) => c.id),
      [
        "portfolio_risk",
        "operational_health",
        "evidence_gaps",
        "blast_radius",
        "rca_intelligence",
      ],
    );
  });

  it("exposes exactly one AVAILABLE capability, and it is Portfolio Risk", () => {
    const available = CAPABILITIES.filter((c) => c.status === "available");
    assert.equal(available.length, 1);
    assert.equal(available[0].id, "portfolio_risk");
  });

  it("exposes exactly three BETA capabilities: Operational Health, Blast Radius, RCA Intelligence", () => {
    const beta = CAPABILITIES.filter((c) => c.status === "beta");
    assert.deepEqual(
      beta.map((c) => c.id).sort(),
      ["blast_radius", "operational_health", "rca_intelligence"],
    );
  });

  it("RCA Intelligence declares QN Operational Corpus evidence and does not claim causation in its question", () => {
    const c = CAPABILITIES.find((x) => x.id === "rca_intelligence");
    assert.ok(c);
    assert.match(c!.evidence, /QN Operational Corpus/);
    assert.doesNotMatch(c!.question, /caused|root cause identified|because of/i);
    assert.doesNotMatch(c!.description, /root cause identified|caused by/i);
  });

  it("Portfolio Risk declares Semantic Layer evidence and never QN", () => {
    const c = CAPABILITIES.find((x) => x.id === "portfolio_risk");
    assert.ok(c);
    assert.equal(c!.evidence, "Semantic Layer");
    assert.doesNotMatch(c!.evidence, /qn/i);
  });

  it("Operational Health declares QN Operational Corpus evidence", () => {
    const c = CAPABILITIES.find((x) => x.id === "operational_health");
    assert.ok(c);
    assert.match(c!.evidence, /QN Operational Corpus/);
  });

  it("evidence_gaps is COMING_NEXT", () => {
    const c = CAPABILITIES.find((x) => x.id === "evidence_gaps");
    assert.ok(c, "evidence_gaps missing");
    assert.equal(c!.status, "coming_next");
  });

  it("every capability has a non-empty question, description and evidence label", () => {
    for (const c of CAPABILITIES) {
      assert.ok(c.question.trim().length > 0, `${c.id}: empty question`);
      assert.ok(c.description.trim().length > 0, `${c.id}: empty description`);
      assert.ok(c.evidence.trim().length > 0, `${c.id}: empty evidence`);
    }
  });

  it("no capability uses hardcoded numeric evidence counts (like 719,946)", () => {
    // Guard against copy that would falsely claim static workbook figures.
    for (const c of CAPABILITIES) {
      for (const field of [c.question, c.description, c.evidence]) {
        assert.doesNotMatch(field, /277[,]?408|442[,]?538|719[,]?946|504/,
          `${c.id}: hardcoded corpus number in "${field}"`);
      }
    }
  });
});
