#!/usr/bin/env python3
"""
Step 1.5 addendum - the seven-file source drop vs the published model.

Compares analysis/source_drop/*.json (normalized catalogue + edge packaging,
as_of 2026-08-21) against data/xops-operational-graph-data.json (the projected
semantic layer the application ships).

Answers three questions and nothing else:
  1. Does the drop carry an Incident -> Application label?   (no)
  2. What does the drop's fuller edge set change?
  3. Where do the two packagings disagree?

Read-only. Neither corpus is modified and neither replaces the other.
"""
import json, collections, statistics, os

DROP = "analysis/source_drop"
L = lambda f: json.load(open(os.path.join(DROP, f)))
R = json.load(open("data/xops-operational-graph-data.json"))

E_AG   = L("edges_app_ag.json")
E_PL   = L("edges_app_platform.json")
AG     = {g["ag_id"]: g for g in L("catalog_assignment_groups.json")}
PL     = {p["platform_id"]: p["name"] for p in L("catalog_platforms.json")}
APPS   = L("catalog_applications.json")
Q      = L("incidents_quality.json")
META   = L("meta.json")
RA     = {a["app_id"]: a for a in R["applications"]}
AGROWS = {g["name"]: g for g in R["assignment_groups"]}
canon  = lambda n: "".join(c for c in (n or "").upper() if c.isalnum())

print("=" * 74)
print("1. DOES THE DROP CARRY A LABEL?")
print("=" * 74)
for f in META["files"]:
    print(f"  {f['file']:<34} grain: {f['grain']}")
print()
LABEL_FIELDS = ["business application", "configuration item", "incident number",
                "number", "ci", "cmdb_ci"]
allkeys = set()
for row in APPS[:1] + [E_AG[0], E_PL[0], Q["by_assignment_group"][0],
                       Q["recurring_patterns"][0], Q["by_decalogue"][0]]:
    allkeys |= {k.lower() for k in row}
hits = [k for k in allkeys if k in LABEL_FIELDS]
print(f"  Fields across all seven files matching a label field: {hits or 'NONE'}")
print(f"  incidents_quality join_note: {Q['meta']['join_note'][:150]}")
print("\n  VERDICT: no incident number, no Business Application, no Configuration")
print("  Item. Same corpus, same grain, different packaging. GROUND TRUTH remains")
print("  NOT AVAILABLE.")

print("\n" + "=" * 74)
print("2. WHAT THE FULLER EDGE SET CHANGES")
print("=" * 74)

drop_pairs = [(e["app_id"], AG[e["ag_id"]]["name"], AG[e["ag_id"]]["ag_key"]) for e in E_AG]
repo_pairs = [(a["app_id"], g, AGROWS[g]["ag_key"] if g in AGROWS else canon(g))
              for a in R["applications"] for g in a["ags"]]
dset = {(a, n) for a, n, _ in drop_pairs}
rset = {(a, n) for a, n, _ in repo_pairs}
print(f"  drop app->AG pairs : {len(drop_pairs)}")
print(f"  repo app->AG pairs : {len(repo_pairs)}")
print(f"  in drop, not in repo: {len(dset - rset)}")
print(f"  in repo, not in drop: {len(rset - dset)}   <- strict superset if 0")

def profile(pairs, qrows, tag):
    by_key = collections.defaultdict(set); by_app = collections.defaultdict(set)
    for aid, _, k in pairs:
        by_key[k].add(aid); by_app[aid].add(k)
    none_ = sum(1 for a in APPS if not by_app[a["app_id"]])
    def part(test):
        u = s = 0
        for a in APPS:
            ks = by_app[a["app_id"]]
            if not ks: continue
            if test(a, ks, by_key): u += 1
            else: s += 1
        return u, s, none_
    ANY = lambda a, ks, ix: any(len(ix[k]) == 1 for k in ks)
    ALL = lambda a, ks, ix: all(len(ix[k]) == 1 for k in ks)
    INT = lambda a, ks, ix: set.intersection(*[ix[k] for k in ks]) == {a["app_id"]}
    sizes = sorted(len(v) for v in by_key.values())
    tot = sum(r["incidents"] for r in qrows); b = collections.Counter(); unm = 0
    for r in qrows:
        k = r["ag_key"]; i = r["incidents"]
        if k not in by_key: unm += i; continue
        n = len(by_key[k])
        b["1" if n == 1 else "2-5" if n <= 5 else "6-20" if n <= 20 else ">20"] += i
    print(f"\n  --- {tag}")
    print(f"    AG keys reaching >=1 application : {len(by_key)}")
    print(f"    partition ANY-singleton          : {part(ANY)}")
    print(f"    partition EVERY-singleton        : {part(ALL)}")
    print(f"    partition intersection           : {part(INT)}")
    print(f"    |cand| median {statistics.median(sizes)}  p90 {sizes[int(.9*len(sizes))]}  max {max(sizes)}")
    print(f"    incidents {tot:,} | zero-candidate {unm:,} ({100*unm/tot:.1f}%) | "
          f"unique {b['1']:,} ({100*b['1']/tot:.1f}%)")

profile(repo_pairs, R["quality"]["by_assignment_group"], "REPO (published model)")
profile(drop_pairs, Q["by_assignment_group"], "DROP (full edge set)")

extra_apps = {a for a, _ in dset - rset}
noag = {a["app_id"] for a in R["applications"] if not a["ags"]}
print(f"\n  The extra pairs touch {len(extra_apps)} applications; "
      f"{len(extra_apps & noag)} of them have NO AG in the published model.")
print("  So restoring them cannot reduce the 192 unrouted applications. Adding")
print("  edges can only ADD candidates, so strict uniqueness moves the wrong way.")

print("\n" + "=" * 74)
print("3. WHERE THE TWO PACKAGINGS DISAGREE")
print("=" * 74)

dp = {(e["app_id"], PL[e["platform_id"]]) for e in E_PL}
rp = {(a["app_id"], p) for a in R["applications"] for p in a["platforms"]}
print(f"  app->platform pair sets identical: {dp == rp}  ({len(dp)} vs {len(rp)})")

tier = collections.defaultdict(set)
for e in E_PL: tier[e["app_id"]].add(e["evidence_tier"])
mixed = [a for a, t in tier.items() if len(t) > 1]
dis = [(a, sorted(tier[a])[0], RA[a]["platform_evidence_tier"]) for a in tier
       if len(tier[a]) == 1 and sorted(tier[a])[0] != RA[a]["platform_evidence_tier"]]
print(f"  applications carrying BOTH E2 and E3 platform edges: {len(mixed)}")
print(f"  applications whose platform tier DISAGREES between packagings: {len(dis)}")
for a, d, r in dis:
    print(f"     {RA[a]['name'][:46]:<48} drop={d}  repo={r}")
print(f"\n  repo tier counts: "
      f"E2={sum(1 for a in R['applications'] if a['platform_evidence_tier']=='E2')} "
      f"E3={sum(1 for a in R['applications'] if a['platform_evidence_tier']=='E3')}")
print(f"  drop tier counts: E2={sum(1 for t in tier.values() if t=={'E2'})} "
      f"E3={sum(1 for t in tier.values() if t=={'E3'})}")

print(f"\n  AG edge evidence tiers in the drop: "
      f"{dict(collections.Counter(e['evidence_tier'] for e in E_AG))}")
print("  -> no bridge/inventory discriminator, so evidence convergence for")
print("     Application -> Assignment Group remains NOT MEASURABLE.")

print(f"\n  recurring_patterns : drop {len(Q['recurring_patterns'])} | "
      f"repo {len(R['quality']['recurring_patterns'])}")
print(f"  by_assignment_group: drop {len(Q['by_assignment_group'])} rows / "
      f"{sum(r['incidents'] for r in Q['by_assignment_group']):,} incidents | "
      f"repo {len(R['quality']['by_assignment_group'])} rows / "
      f"{sum(r['incidents'] for r in R['quality']['by_assignment_group']):,} incidents")
print(f"  join_coverage      : drop {Q['meta']['join_coverage']['ags_matched']} of "
      f"{Q['meta']['join_coverage']['ags_bridge']} / {Q['meta']['join_coverage']['incident_coverage_pct']}% | "
      f"repo {R['quality']['meta']['join_coverage']['ags_matched']} of "
      f"{R['quality']['meta']['join_coverage']['ags_bridge']} / "
      f"{R['quality']['meta']['join_coverage']['incident_coverage_pct']}%")
print("\n  Neither packaging dominates: the drop has more AG edges, the repo has")
print("  more recurring patterns. They coexist. Neither replaces the other.")
