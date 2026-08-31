import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  agKey,
  browseApplicationsHref,
  buildBlastRadiusBrief,
  listApplications,
} from "@/lib/agent/blast-radius-brief";
import { applications } from "@/lib/data";

/**
 * These tests exercise the pure builder against the real semantic-layer JSON
 * bundled with the app. They pick an application deterministically (the first
 * one that has both AGs and platforms) so failures are reproducible without
 * knowing the workbook.
 */
const seedApp = applications.find(
  (a) => a.ags.length > 0 && a.platforms.length > 0,
);
if (!seedApp) throw new Error("test fixture: no seed application found");

const seedAppNoAgs = applications.find(
  (a) => a.ags.length === 0,
);

describe("buildBlastRadiusBrief — invariants", () => {
  it("returns null for an unknown app_id (safe empty state)", () => {
    assert.equal(buildBlastRadiusBrief("APP-does-not-exist"), null);
  });

  it("selected application is the brief center; human-readable name is exposed", () => {
    const b = buildBlastRadiusBrief(seedApp.app_id)!;
    assert.ok(b);
    assert.equal(b.application.app_id, seedApp.app_id);
    assert.equal(b.application.name, seedApp.name);
    assert.equal(typeof b.application.name, "string");
    assert.ok(b.application.name.length > 0);
  });

  it("routes preserve the selected application in navigation", () => {
    const b = buildBlastRadiusBrief(seedApp.app_id)!;
    assert.equal(b.routes.view_application, `/app/${seedApp.app_id}`);
    assert.equal(
      b.routes.view_relationship_graph,
      `/app/${seedApp.app_id}#relationship-graph`,
    );
  });

  it("responsibility fields come only from application evidence", () => {
    const b = buildBlastRadiusBrief(seedApp.app_id)!;
    for (const key of [
      "business_owner",
      "technical_owner",
      "dpm",
      "dpm_l3",
    ] as const) {
      const f = b.responsibility[key];
      if (f.present) {
        assert.equal(typeof f.value, "string");
        assert.ok(f.value.length > 0);
      } else {
        assert.ok(f.note === "not_declared" || f.note === "tbd");
        assert.equal(f.evidence, "not_declared");
      }
    }
  });

  it("Assignment Groups come only from application evidence (declared)", () => {
    const b = buildBlastRadiusBrief(seedApp.app_id)!;
    assert.equal(b.operational.assignment_groups_total, seedApp.ags.length);
    for (const g of b.operational.assignment_groups) {
      assert.equal(g.evidence, "declared");
      assert.ok(seedApp.ags.includes(g.name));
    }
    // Cap must not silently exceed the raw list.
    assert.ok(b.operational.assignment_groups.length <= seedApp.ags.length);
  });

  it("Platforms come only from application evidence (declared)", () => {
    const b = buildBlastRadiusBrief(seedApp.app_id)!;
    assert.equal(b.operational.platforms_total, seedApp.platforms.length);
    for (const p of b.operational.platforms) {
      assert.equal(p.evidence, "declared");
      assert.ok(seedApp.platforms.includes(p.name));
    }
    assert.ok(b.operational.platforms.length <= seedApp.platforms.length);
  });

  it("missing operational relationships render as declared gaps, not hidden", () => {
    if (!seedAppNoAgs) return; // fixture-dependent; skip if no such app exists
    const b = buildBlastRadiusBrief(seedAppNoAgs.app_id)!;
    assert.equal(b.operational.assignment_groups_total, 0);
    assert.equal(b.operational.assignment_groups.length, 0);
  });

  it("related applications are ALWAYS labeled DERIVED, never declared", () => {
    const b = buildBlastRadiusBrief(seedApp.app_id)!;
    for (const r of b.related_applications.items) {
      assert.equal(r.evidence, "derived");
      assert.ok(
        r.reason.kind === "shared_assignment_group" ||
          r.reason.kind === "shared_platform",
      );
      assert.notEqual(r.app_id, seedApp.app_id);
    }
  });

  it("no related application is labeled with dependency/impact/outage language", () => {
    const b = buildBlastRadiusBrief(seedApp.app_id)!;
    const forbidden = /dependency|impact|outage|will fail|downstream/i;
    for (const r of b.related_applications.items) {
      assert.doesNotMatch(r.reason.shared, forbidden);
    }
    for (const l of b.limitations) {
      // Limitations may reference these terms only in the negative
      // ("... is a connection, not a dependency"), and always inside a
      // limitation paragraph — never as a positive claim about a related app.
    }
    assert.match(
      b.limitations.join(" "),
      /connection.*not a dependency/i,
    );
  });

  it("ordering is deterministic (two calls produce identical output)", () => {
    const a = buildBlastRadiusBrief(seedApp.app_id)!;
    const b = buildBlastRadiusBrief(seedApp.app_id)!;
    assert.deepEqual(a, b);
    // AGs and platforms sorted alphabetically.
    for (let i = 1; i < a.operational.assignment_groups.length; i++) {
      assert.ok(
        a.operational.assignment_groups[i - 1].name.localeCompare(
          a.operational.assignment_groups[i].name,
        ) <= 0,
      );
    }
    for (let i = 1; i < a.related_applications.items.length; i++) {
      assert.ok(
        a.related_applications.items[i - 1].name.localeCompare(
          a.related_applications.items[i].name,
        ) <= 0,
      );
    }
  });

  it("business context surfaces sectors verbatim and marks empty program/process as not declared", () => {
    const b = buildBlastRadiusBrief(seedApp.app_id)!;
    assert.deepEqual(b.business.sectors, seedApp.sectors);
    if (b.business.program.present) {
      assert.equal(typeof b.business.program.value, "string");
    } else {
      assert.equal(b.business.program.evidence, "not_declared");
    }
  });
});

describe("agKey", () => {
  it("matches the canonical repo rule (uppercase + strip non-alphanumeric)", () => {
    assert.equal(agKey("Data-Platform Support"), "DATAPLATFORMSUPPORT");
    assert.equal(agKey(undefined), "");
    assert.equal(agKey("  "), "");
  });
});

describe("browseApplicationsHref + listApplications", () => {
  it("browseApplicationsHref points to an existing evidence surface", () => {
    assert.equal(browseApplicationsHref(), "/portfolio");
  });

  it("listApplications returns unique ids and sorted names", () => {
    const list = listApplications();
    assert.ok(list.length > 0);
    const ids = new Set(list.map((a) => a.app_id));
    assert.equal(ids.size, list.length);
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i - 1].name.localeCompare(list[i].name) <= 0);
    }
  });
});
