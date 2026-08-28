# Step 1.5 — Relationship Discovery Evaluation · Experiment Report

**Status:** partial by necessity. Ground truth for `Incident → Application` is **NOT AVAILABLE**,
so every accuracy-class experiment in the brief (items 8, 12, 13, 14, 16) is blocked. Everything
that can be measured without a label has been measured and is reported below.

**Reproduce:** `python3 analysis/step15_labelfree.py` → `analysis/step15_output.txt`.
Read-only against `data/xops-operational-graph-data.json`. Nothing is written back to the model.

---

## 0. What is actually on disk in this container

This is the first finding, and it constrains everything after it.

| Artifact | Present | Consequence |
|---|---|---|
| `data/xops-operational-graph-data.json` (the projected semantic layer) | **Yes** | All measurements below come from this and only this |
| `7773fc71-XOps_Operational_Graph_Semantic_Layer_v3.xlsx` (its source) | **No** | `npm run data` cannot run; the projector cannot be re-run or extended |
| `QN_v242_contract.json`, `QN_v242_aggregates.json` | **No** | Already declared blocked in `HANDOFF.md` §4 |
| `QN_p120826_FULL_2_4_2_RO_270826.xlsx` (719,946 incidents) | **No** | — |
| The 500-row `User_Detail` / `Alert_Detail` sample analysed in the previous session | **No** | The 73.4% AG coverage, 61.3% uniqueness and 6.4% Service Offering figures **cannot be reproduced, re-cut or extended here** |

Verified by filesystem search across the container, not inferred. `data/` holds one file.

This means: **no field carrying a Service Offering, a Short Description, an incident number or a
ticket-grain Assignment Group exists in this container.** The signals the brief asks to inventory
in item 3 are, three of them, not present to be measured. What can be measured is the *structure*
those signals would have to resolve against — and that turns out to be where the decisive results are.

---

## A. Ground truth

**Classification: GROUND TRUTH NOT AVAILABLE.** Re-confirmed against the loaded corpus, and now
independently corroborated by the corpus's own metadata rather than only by my inspection:

- `meta.incident_link.available = false`; `grain_missing = "one row per incident, with its incident number"`
- `HANDOFF.md` §4 registers `INCIDENT_TO_APPLICATION` as a **blocked metric** with the reason already
  written down: *"Service Offering empata 4.7% / 0%. El enlace va por AG y es aproximación rotulada."*
- The same section registers `MTTR` blocked (no `opened_at`, invariant QN13) and `REASSIGNMENT`
  blocked (no reassignment count). Those are the two fields the +16.6h and 33.7% business-case
  claims would need.

So the project had already concluded, in writing, that this link is an approximation. Step 1.5's
ground-truth investigation reaches the same verdict from the data side.

**Size and composition of the legitimate evaluation population: zero records.** No incident in
this corpus carries an application attribution from any source independent of Assignment Group.

**No labels were manufactured.** No proxy label was constructed from Service Offering, no
evaluation was restricted to a labelable subset, and no figure derived from doing so appears
anywhere in this report.

---

## B. Signal inventory

### B1. The definition of "unique route" moves the answer by 3×

The Step-1 headline partition reproduces exactly — but only under one of six defensible
definitions, and it is the most optimistic one:

| Definition | unique | shared | no route |
|---|---:|---:|---:|
| canonical AG key · **ANY** AG is a singleton ← **the published 102/210/192** | 102 | 210 | 192 |
| canonical AG key · **EVERY** AG is a singleton | **37** | 275 | 192 |
| canonical AG key · intersection of the app's AGs == the app | 119 | 193 | 192 |
| raw AG name · ANY singleton | 104 | 208 | 192 |
| raw AG name · EVERY singleton | 39 | 273 | 192 |
| raw AG name · intersection == the app | 121 | 191 | 192 |

An application counted as "unique route" under the published definition may hold a second
assignment group shared with 41 other applications. The strict reading gives **37**, not 102.
This is not an error — it is an undocumented definition. It should be written down next to the
number, because "402 of 504 do not yield a unique route" becomes "467 of 504" under the strict
reading, and the two support different conclusions.

### B2. G1 · Assignment Group → Application, weighted by incident volume

Group-weighted (each AG counted once) the signal looks strong: 174 of 249 AG keys (69.9%) reach
exactly one application, median candidate set 1.

That is not the operational question. Incidents are not distributed uniformly across groups.
Weighting by the declared incident volume at AG grain:

| \|candidates\| | AG rows | incidents | % of catalogue |
|---|---:|---:|---:|
| **0 — unresolved** | 62 | 81,571 | **34.9%** |
| **1 — unique candidate** | 45 | 68,740 | **29.4%** |
| 2–5 | 21 | 64,548 | 27.6% |
| 6–20 | 8 | 6,123 | 2.6% |
| >20 | 4 | 12,852 | 5.5% |

**Denominator:** 233,834 incidents published across 140 AG rows in `quality.by_assignment_group`
— 96.3% of the 242,706 eligible `User_Detail` rows. This is **User_Detail only**; all 442,538
`Alert_Detail` rows (61.5% of the corpus) are outside this table entirely and are not represented
in any figure above.

Two things follow:

1. **The single largest assignment group in the corpus resolves to nothing.**
   `SERVICE DESK S&T AMESA ENGLISH`, 31,786 incidents, reaches zero applications. So do
   `B2B CALL CENTER - CO` (17,345) and `DIGITIZED MANUFACTURING` (6,137). One third of catalogued
   incident volume sits behind groups with no bridge row at all.
2. **The largest group that *does* resolve is ambiguous.** `DATA FABRIC OPERATIONS`, 31,785
   incidents, yields 2 candidates. `LINUX COMPUTE` (7,844) yields 34. `WINDOWS COMPUTE` (3,512)
   yields 42.

**Divergence to flag, not to reconcile silently:** the previous session's ticket sample reported
73.4% AG coverage and 61.3% single-candidate among joined tickets. Incident-volume weighting on
the declared AG catalogue gives **65.1% coverage** and **29.4% single-candidate over the whole
catalogue** (45.1% among joined). Different populations, different denominators, different grains
— the 500-row sample was date-ordered over 19 days, this is 2.5 years of AG-grain aggregate. I am
not reconciling them. The gap is itself the reason a per-incident extract is needed.

### B3. G4 · Graph-mediated, `AG → apps → platform → apps`

The brief asks (item 6) whether an indirect path preserves evidence. Measured, it does — but as
an expansion, not a resolution:

| | direct | + platform hop |
|---|---:|---:|
| AG keys yielding exactly 1 candidate | 174 | **65** |
| median candidate set | 1 | **20** |
| p90 candidate set | 5 | **157** |
| max | 42 | **249** |
| incidents landing in a >20-candidate set | 12,852 | **137,147** |

The hop is monotonic: on this graph it can only add candidates, never remove them. It reaches
applications that AG alone cannot see, which is real evidence — but as a standalone generator it
destroys resolution for 109 AG keys that were previously unique. **Verdict: keep as a
corroborator for a candidate another signal already nominated; reject as a resolver.**

### B4. G5 · Free text → Application

The only text corpus loaded is `quality.recurring_patterns` — 200 stemmed signatures covering
62,343 incidents.

- **Strict matching** (full application name present as a token-bounded substring):
  **0 of 200 signatures**. Not one recurring signature spells out a Business Application name.
  The matcher is not broken — it matches correctly on constructed test strings.
- **Loose matching** (any distinctive ≥5-char token from an application name): 133 of 200
  signatures, 24,884 incidents.

The loose result is the false-positive demonstration item 17 asks for, measured rather than asserted:

| token | signatures | incidents | applications it claims |
|---|---:|---:|---:|
| MOBILE | 85 | 11,791 | 2 |
| AMESA | 25 | 3,093 | 10 |
| INDIA | 11 | 1,681 | 2 |
| ORDER | 8 | 895 | 6 |
| APPLICATION | 7 | 7,950 | 3 |
| MONITORING | 2 | 7,364 | 1 |

Every top driver is a generic English or region word. Loosening the matcher moved coverage from
0% to 66.5% of signatures and produced **no identifying evidence whatsoever**. Coverage is
trivially purchasable; on its own it is worth nothing.

This says nothing about Short Description, which is raw per-ticket text and is not loaded.
Recurring signatures are deduplicated machine text. **Neither result transfers to the other.**

---

## C. Normalization findings

Ladder applied to the 504-name application namespace, measuring collisions introduced against
cross-namespace hits gained:

| rule | distinct app keys | collisions | AG-name hits | platform-name hits |
|---|---:|---:|---:|---:|
| N0 raw | 504 | 0 | 3 | 4 |
| N1 case + whitespace | 504 | 0 | 3 | 4 |
| N2 + punctuation | 504 | 0 | 3 | 4 |
| N3 + strip `" - SO"` | 504 | 0 | 3 | 4 |
| N4 + strip env suffix (PROD/DEV/TEST…) | 504 | 0 | 3 | 4 |
| **N5 + strip region suffix** | **501** | **3** | 6 | 4 |
| N6 alnum-only (the model's AG normalizer) | 504 | 0 | 4 | 4 |

N1–N4 and N6 are **safe** (zero collisions) and nearly free (3–4 hits out of 250 AG names).
**N5 is the first rule that costs more than it returns** — +3 cross-namespace hits, −3 distinct
applications:

- `COMMERCIAL COCKPIT` ← `Commercial Cockpit` + `COMMERCIAL COCKPIT EUROPE`
- `MOST VALUABLE STORE` ← `MOST VALUABLE STORE AMESA APAC` + `… APAC - INDIA`
- `SDNA` ← `SDNA GLOBAL` + `SDNA GLOBAL-India`

Those are distinct applications with distinct owners. **Reject N5.**

The `" - SO"` strip is safe here but gains nothing here — its reported 0% → 6.4% payoff was
measured against Service Offering values that are not in this container. The coverage half of
this table cannot be completed until they are.

---

## D. Entity-space findings

Deterministic where possible (the 38 platform names are declared), lexicon-heuristic otherwise.
**This is a heuristic over names. It is not declared metadata and must not be promoted.**

Over the 250 distinct AG names carried by applications:

| domain | count | share |
|---|---:|---:|
| SERVICE (service desk / support / offering) | 113 | 45.2% |
| **UNKNOWN** | 107 | 42.8% |
| PLATFORM | 12 | 4.8% |
| INFRASTRUCTURE | 8 | 3.2% |
| DATABASE | 8 | 3.2% |
| APPLICATION | 2 | 0.8% |

Cross-namespace identity, measured rather than assumed:

- AG names that are exactly an application name: **3 of 250 (1.2%)**
- Application names that are exactly a platform name: **4 of 504**

**The three namespaces are effectively disjoint.** The Assignment Group namespace is a
support-organisation namespace, not an application namespace — under 1% of it names an
application. This is the structural reason a ticket cannot be string-matched to an application,
and it corroborates the hypothesis from the Service Offering work (`VMWARE VCENTER PROD`,
`PIC MACON DC PROD`) with a measurement: unmatched values are not failed matches, they are
**values from a different namespace**. Every bridge in this corpus is a declared table, not a
string identity, and that is the correct architecture.

---

## E. Candidate generators — feasibility against the loaded evidence

| | generator | feasible here | measured |
|---|---|---|---|
| G1 | Assignment Group → apps | **Yes** | §B2 |
| G2 | Service Offering exact/normalized | **No** — field absent | — |
| G3 | Configuration Item | **No** — field absent from all 37 + 17 detail columns | — |
| G4 | Deterministic graph traversal (platform hop) | **Yes** | §B3 |
| G5 | Short Description entity matching | **No** — proxy only (recurring signatures) | §B4 |
| G6 | Application aliases / entity resolution | **No** — no alias table exists in the corpus | — |
| G7 | Historical operational co-occurrence | **No** — needs incident grain | — |
| G8 | Semantic similarity | Blocked — nothing to evaluate it against | — |
| G9 | Graph-neighbourhood similarity | Blocked — same | — |
| G10 | LLM entity extraction / synthesis | Blocked — same | — |

Two of ten are runnable. Neither can be scored for correctness.

**Candidate-set reduction** against the 504-application prior — reported as set reduction, never
as a probability:

| signal | median \|candidates\| | portfolio eliminated |
|---|---:|---:|
| prior (no signal) | 504 | 0.00% |
| AG → apps (declared bridge) | 1 | 99.80% |
| AG → apps → platform → apps | 20 | 96.03% |

A median of 1 candidate is **not** a 99.8% chance of being correct. It is a statement about set
size. Correctness is unmeasurable without a label.

---

## F. Ensemble experiments

**Result: not measurable on the loaded corpus — and not for the reason one would expect.**

Convergence and conflict were computed at signature grain, `top_ag` (G1) against text extraction
(G5), over 200 signatures and 62,343 incidents:

| outcome | signatures | incidents | % |
|---|---:|---:|---:|
| CONVERGENCE (sets intersect) | **0** | 0 | 0.0% |
| CONFLICT (both non-empty, disjoint) | **0** | 0 | 0.0% |
| AG only | 60 | 44,019 | 70.6% |
| text only | 0 | 0 | 0.0% |
| UNRESOLVED (neither) | 140 | 18,324 | 29.4% |

Both zero — **not because the signals agree, but because they never both fire.** Exactly one
generator ever produces a candidate. There is nothing to combine, in either direction. The central
question of the brief — *how much ambiguity can be resolved by combining independent evidence* —
cannot be answered against this container's data at all.

### F1. The corpus destroys its own corroboration signal at build time

This is the most actionable finding in the report, and it is a code finding.

`scripts/build_data.py:152-158`:

```python
ba = ag_pairs.get(app_id, [])
if ba:
    ag_names = [x["assignment_group"] for x in ba]   # bridge sheet 05
    ag_from  = "bridge"
else:
    ag_names = split_list(a["assignment_groups"], ";")  # Margarita inventory
    ag_from  = "inventory"
```

`Application → Assignment Group` has **two sources** — the bridge sheet and the inventory column.
The projector takes the bridge when it exists and **discards the inventory's own answer**. 165
applications are bridge-sourced; for every one of them a second, independently-authored opinion
about the same relationship exists upstream and never reaches the JSON. Whether the two agree is
unknown and unknowable from the published model.

The same shape appears on `Platform → Application`: `plat_names` always comes from one column, and
the E2/E3 bridge only sets an evidence *tier flag* (`build_data.py:171`). The 91 E2 and 149 E3
applications are a provenance label on a single answer, not two answers.

So the corpus contains **exactly one place** where two independent sources speak about the same
relationship, and the build collapses it to a single winner before publishing. Evidence
convergence — the first-class concept item 9 asks for — is destroyed upstream of anywhere it
could be measured. **The fix is cheap and does not change a single declared relationship:** publish
both source lists per application plus an agreement flag (`agree` / `bridge_only` / `inventory_only`
/ `disagree`), and keep the bridge as the published value. That turns a discarded byte into the
only corroboration measurement the project can currently make.

### F2. Quality-join coverage is not attribution coverage

`meta.quality.join_coverage.ags_matched = 79`; my join finds 78 AG rows reaching ≥1 application.
The difference is not an error: the model counts an AG as *matched* against the 265-key catalogue,
which includes **18 AGs that reach zero applications**. Incident coverage is materially the same
(65.2% published vs 65.1% measured), but the two statements mean different things and are one
sentence apart in the interface. "This group's quality is measured" ≠ "this group's incidents can
be attributed to an application."

---

## G. AI/ML experiments

**None run.** Correctly so: with no label there is nothing to train against, nothing to validate
against, and no way to distinguish a good retriever from a confident wrong one. Running embeddings
or an LLM here would produce output that looks like progress and carries no information. Items 12,
13 and 14 stay closed until §J is unblocked.

---

## H. Error analysis

Without labels there are no false positives to inspect — but two systematic failure modes are
visible structurally:

1. **Volume concentrates in the unresolvable.** The top unjoined group alone (31,786 incidents) is
   larger than any joined group. The failures are not a long tail of odd cases; they are the
   biggest groups in the corpus, and they are service-desk groups — front doors that legitimately
   touch many applications. No amount of signal engineering fixes a group that is *genuinely*
   many-to-many; that is a data-capture problem, not an inference problem.
2. **Coverage is purchasable and correctness is not.** §B4 measures this directly: relaxing one
   matching threshold moved text coverage from 0% to 66.5% of signatures on generic words alone.
   Any future scoring model will face the same gradient. This is the concrete argument for
   preserving UNKNOWN.

---

## I. Recommended production strategy

**Promote now:** nothing. No inference method measured here is strong enough to write into the
graph, and none can be, without a label.

**Keep as a labelled candidate generator (not a resolver):**
- **G1 Assignment Group** — the only generator with real coverage. Must surface its candidate set
  honestly: 34.9% of catalogued incident volume gets **UNKNOWN**, 29.4% gets one candidate, 35.7%
  gets several. Present the set, never a pick.
- **G4 platform hop** — corroboration only, explicitly labelled as an expansion, never as a resolver.

**Reject:**
- N5 region-suffix normalization (merges distinct applications).
- Loose text-token matching (measured to be pure noise).
- Any single-candidate → "correct" promotion. §B2's 29.4% is a set-size statement.

**Cheapest real win, and it needs no new data:** §F1. Publish both AG sources with an agreement
flag. It is the only convergence measurement available today, it costs one build change, and it
changes no declared relationship.

**Second:** write the "unique route" definition next to the 102/210/192 number (§B1).

**Third:** separate "quality measured for this group" from "incidents attributable to an
application" in the interface copy (§F2).

---

## J. Remaining unknown

Unchanged and now doubly confirmed. What would unlock proper evaluation, in priority order:

| Field | Grain | Unlocks |
|---|---|---|
| `Business Application`, or `Configuration Item` + a CI→application table | one row per incident | The label. Authoritative and independent of AG. Enables accuracy / precision / recall, items 8, 12, 13, 14, 16 |
| `Number` / incident ID | one row per incident | Joins across sheets, deduplication, per-ticket convergence instead of signature-grain bounds |
| `opened_at`, `resolved_at` | one row per incident | Time-to-resolve — the only path to the +16.6h claim. `QN13` says `opened_at` does not exist; **never derive it from `Closed At`** |
| Assignment Group reassignment trail | one row per assignment event | First-touch vs resolving group — the misroute signal the 33.7% claim rests on |
| Both AG source columns, unmerged | one row per application | §F1. Available today, no new extract needed |
| CMDB relationship export (CI ↔ application ↔ platform) | one row per relationship | Would make attribution *declared* rather than inferred |

**Minimum viable unlock: one row per incident carrying an incident number and a Business
Application or Configuration Item.** Everything else is refinement.

Also still missing *in this container*, and needed before any of the above can even be re-cut:
the semantic-layer xlsx, `data/QN_v242_contract.json` and `data/QN_v242_aggregates.json`
(`HANDOFF.md` §4 blockage, still open).

---

## K. Proposed discovery invariants (item 19)

Proposed, not implemented — there is no discovery layer to attach them to yet. Written to match the
build's existing invariant style so they can be dropped into `scripts/build_data.py` when there is.

| # | Invariant |
|---|---|
| D1 | A declared relationship is never overwritten by an inferred one. |
| D2 | An inferred relationship never becomes declared without a recorded human confirmation. |
| D3 | A candidate score is never rendered as a percentage or a probability unless a calibration curve is published alongside it. |
| D4 | No evaluation label may be derived from a signal that the same evaluation scores. |
| D5 | UNKNOWN is a valid, publishable result and is never filled by a fallback. |
| D6 | Conflicting sources surface as CONFLICT; they are never averaged into a single score. |
| D7 | Sample-derived figures carry their sample size and window, and never stand in for the population. |
| D8 | A candidate set of size 1 is published as a set of size 1, never as an answer. |
| D9 | Every candidate carries its generator and its full evidence path; a candidate with no path is not published. |
| D10 | A normalization rule that reduces the count of distinct entities is rejected unless the merge is declared upstream. |

D10 is what rejects N5. D4 is what rejects the Service Offering proxy label. D8 is what rejects
reading §B2's 29.4% as an accuracy.
