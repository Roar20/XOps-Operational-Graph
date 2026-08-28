# XOps Operational Graph — Project Handoff

> Continuation contract. Read this first, then inspect the repository, then continue
> from §29.
>
> **Repository:** `Roar20/XOps-Operational-Graph`
> **Working branch:** `claude/handoff-qn-data-setup-pi5neu`
> **HEAD at time of writing:** `53a86ff` — *Paso 1: modelo de relaciones, con la evidencia separada por capas*
> **Interface language:** English. **Code comments:** Spanish, unaccented, in `lib/` and `scripts/`.
>
> A note on the older `HANDOFF.md` in the repository root: it predates the business-case
> realignment and its narrative sections are **SUPERSEDED** by this document. Its §1 contract
> rules (R1–R9) remain in force. One factual claim in it is wrong and is corrected here:
> it states "28 invariantes de build en `scripts/build_data.py`"; the file contains **13**
> `checks.append(...)` calls.

---

## 1. Executive Context

PepsiCo runs a portfolio of ~504 BI and AI/ML applications. Operations — routing an
incident, assessing what a platform failure takes down, knowing who answers — depend on
*relationships between* those applications, platforms, support groups, processes and
owners. The authoritative inventory stores them as a flat list of records.

This application exists to demonstrate, with measured evidence, that the flat list cannot
answer operational questions reliably, and to show precisely which relationships are
missing, which are shared, what that costs in exposure, and who could confirm them.

**Target users.** Two depths, one product: an operations or portfolio manager who needs
problem, magnitude, location and next action; and an analyst or engineer who needs
distributions, provenance, raw records and drill-down.

**Decision supported.** Three, taken from the business case:

1. Confirm whether exposed processes and sectors match operational reality.
2. Prioritise which relationship gaps to close first.
3. Identify the owners who can confirm missing relationships.

**What makes it different from a dashboard.** Every figure carries its provenance and its
evidence status. The product refuses to present a number it cannot source, refuses to
derive a blocked measure, and preserves disagreement with the business case rather than
forcing the expected value. It is a decision instrument that states where its evidence
stops.

**POC boundaries.** Static by design — no database, no authentication, no server-side
persistence. The one server route is `/api/chat` for the agent. The uploaded workbook is
processed entirely in the browser and never leaves the machine.

---

## 2. Product Thesis

The portfolio is stored as 504 individual records, but operations run on a network of
relationships — and for 402 of those 504 applications the declared support relationship
alone does not identify the application uniquely. The product makes that network visible:
what is declared, what is shared, what is missing, what exposure follows from the shared
parts, and which relationships must be confirmed to make operational questions answerable
deterministically.

The thesis is deliberately about *the relationship model*, not about documentation
quality. Quality is Level 4 supporting evidence (§17).

---

## 3. Business Case

### Measured today — reproduced from the loaded model

| Claim | Value | Source |
|---|---|---|
| Applications in the portfolio | 504 | `data/xops-operational-graph-data.json` |
| On more than one platform | 156 | `applications[].platforms` |
| With neither platform nor support group | 187 | both link arrays empty |
| Support-route partition | 102 unique / 210 shared / 192 none | AG bridge, §12 |
| Support groups in the bridge | 249, of which 75 shared (30.1%) | derived |
| Most-shared group | `WINDOWS COMPUTE`, 42 applications | derived |
| Documentation quality trend | four measures improving, §17 | `quality.baseline_metrics` |

### Hypothesised, with a defined test

**Reducing non-unique or missing relationships reduces incident resolution time.**
Test: confirm relationships for a cohort of applications, then compare resolution
behaviour before and after **within a controlled priority tier and channel**. Requires the
incident-grain extract in §28.

### Not claimed

- Financial saving. No cost model exists in any loaded dataset.
- Headcount reduction.
- That close-notes compliance *causes* poor documentation quality. The correlation is
  −0.154, which is the absence of a relationship, not a negative one.
- That any alert-handling profile indicates misconfiguration. No monitor configuration or
  suppression state is loaded.

### Organisational cost of the POC

Not documented in any artefact available to this session. **UNKNOWN.** Do not invent a
figure; ask before publishing one.

---

## 4. Narrative Architecture

**DECIDED**, approved. Not yet reflected in the UI.

```
L1  STRUCTURAL GAP      the portfolio is a list; operations are a network
L2  RELATIONSHIP GAPS   what is declared, what is shared, what is missing
L3  ROUTING             where the declared support route is unique / shared / absent
L4  OPERATIONAL         [BLOCKED] what non-uniqueness costs at incident grain
    CONSEQUENCE
L5  EXPOSURE            direct vs second-order blast radius through shared responders
L6  OPERATIONAL QUALITY supporting evidence — improvement, concentration, saturated control
L7  EVIDENCE            records, groups, examples, provenance
L8  ACTION              which relationships to confirm, and by whom
```

L4 is a **named, unlockable dependency**, not a number. See §12 and §28. Rendering it as a
declared gap is stronger for the business case than omitting it, and is the only honest
option because the measure is not derivable (§10).

### Operational Quality is a supporting story

It answers one specific objection: *"field-level controls already cover this."* The
evidence that they do not:

- All 36 assignment groups with ≥1,000 incidents carry a GREEN close-notes status.
- Five of those have a Poor + Critical rate ≥30%; the worst records 86.6% poor at 100%
  close-notes population.
- Pearson correlation across those 36 groups between close-notes rate and Poor + Critical
  rate: **−0.154**.
- Separately, 20 groups hold **81.7%** of all Poor + Critical records.

**Correct framing:** *compliance is saturated (96.1% against a 30% target) and therefore
weak as a discriminator of documentation quality.* Never "compliance is useless." Never a
causal claim. And always lead with the improvement (§17) — the data says quality got
materially better, and presenting this as a failure narrative misreads it.

---

## 5. Questions the Product Must Answer

| # | Question | Why it matters | Evidence required | Answerable today | Where it belongs |
|---|---|---|---|---|---|
| 1 | Can we answer operational questions deterministically? | The thesis | AG bridge | **Yes** — 102/210/192 | Landing page (rewrite) |
| 2 | Which relationships are plural, and which absent? | Names the structural cause | `platforms`, `ags`, `process`, owner fields | **Yes** | Relationships domain |
| 3 | If a platform fails, what falls — directly and through shared responders? | The clearest proof a graph beats a list | platform → app → group → app traversal | **Yes** | Blast Radius, extended |
| 4 | How often is incident attribution actually ambiguous? | The business case's operational signal | incident-grain attribution | **No — BLOCKED** | Declared gap, §28 |
| 5 | Does non-unique routing cost resolution time? | Converts structure into consequence | `opened_at` + priority + channel | **No — BLOCKED** | Declared gap, §28 |
| 6 | Is the work documented well enough to investigate from? | Determines whether evidence is usable | QN aggregate sheets | **Yes** | Quality domain |
| 7 | Which relationships get confirmed first, and by whom? | The decision requested | coverage + declared owners | **Partially** — owners known for 458/504 | Action, not built |

---

## 6. Current Information Architecture

### Navigation as it exists (`components/Nav.tsx`)

`Overview` · `Portfolio Health` · `Sectors` · `Blast Radius` · `Relationships` ·
`Work Notes Quality` · `AI Ops` · `Load Data`

`/agent` and `/app/[app_id]` are reachable but **not in the nav**.

### Routes and purpose

| Route | File | Purpose | Narrative fit |
|---|---|---|---|
| `/` | `app/page.tsx` → `components/Overview.tsx` | Portfolio coverage, business impact, routing gap | **Needs rewrite.** Does not state the structural problem |
| `/portfolio` | `app/portfolio/page.tsx` | Four chain links + full application table | **Reframe.** Coverage % collapses routing states |
| `/sectors` | `app/sectors/page.tsx` | Sector reach, non-additive | Keep |
| `/blast-radius` | `app/blast-radius/page.tsx` | Deduplicated platform union, R4 | **Extend** with second-order |
| `/graph` | `app/graph/page.tsx` → `RelationshipExplorer` | Sankey + neighbourhood graph | Keep; closest to the thesis today |
| `/quality` | `app/quality/page.tsx` | `CorpusAnalysis` (uploaded workbook) above, `QualityModule` (semantic layer) below | **Reorder.** Lead with improvement |
| `/ai-ops` | `app/ai-ops/page.tsx` | AI/ML segment on the four links | Keep, unchanged |
| `/upload` | `app/upload/page.tsx` | Corpus load, datasets, invariants | Keep. Working entry point |
| `/agent` | `app/agent/page.tsx` | Chat over nine tools | **Reposition.** Should be reachable *from a finding* |
| `/app/[app_id]` | 504 prerendered records | Full application record | Keep |
| `/api/chat` | `app/api/chat/route.ts` | AI Gateway endpoint | Keep. **Unprotected** — see §28 |

### Diagnosis of navigation

Six of eight nav entries belong to the application-inventory product; the corpus occupies
one entry named after a spreadsheet concept; `Load Data` sits last though it is the entry
point. **The navigation reflects the data model, not the user's reasoning.**

Agreed direction (**DECIDED**, not implemented): six question-driven domains — *The gap ·
Relationships · Exposure · Quality · AI portfolio · Corpus*. **Evidence is not a nav
entry**; it is the drawer (`components/Drawer.tsx`) that opens from any figure.

### Missing analytical transitions

- No screen states a problem; every block is descriptive.
- Group tables sort by volume, never by contribution to a problem.
- Drill-down exists (`Drawer`, `AppInspector`, agent `lookup_ticket`) but nothing upstream
  ever hands the user a reason to use it.
- The two quality sources on `/quality` are separated by a horizontal rule with no
  explanation of precedence.

---

## 7. Data Architecture

### Source A — semantic layer (build-time, ships with the app)

`data/xops-operational-graph-data.json` (≈879 KB). Produced by
`scripts/build_data.py` from `XOps_Operational_Graph_Semantic_Layer_v3.xlsx`, which is
**not versioned** — the convention is that source workbooks live outside the repository.

| Key | Rows | Notes |
|---|---|---|
| `applications` | 504 | 37 fields; see field coverage below |
| `platforms` | 38 | `app_ids`, `blast_radius_direct`, tier, `is_ai_platform` |
| `assignment_groups` | 268 | `ag_key`, `app_ids`, `processes`, `dpms` |
| `sectors` | 11 | non-additive by design |
| `coverage` | 4 | the four chain links with evidence tiers |
| `measures` | 16 | traceability registry behind `components/Trace.tsx` |
| `workspaces` | 159 | dashboard consumption, §7 extension, unused in v1 |
| `quality` | — | **an embedded QN projection**; see the precedence note below |

Field coverage on `applications` (verified):

| Field | Populated | Distinct |
|---|---:|---:|
| `name`, `app_id`, `criticality` | 504 (100%) | 504 / 504 / 4 |
| `process` | 491 (97.4%) | 9 |
| `sector` | 386 (76.6%) | 154 |
| `dpm` | 383 (76.0%) | 62 |
| `tech_lead` | 274 (54.4%) | 36 |
| `owner` | 238 (47.2%) | 92 |
| `ags` | 312 (61.9%) | 173 |
| `technology_raw` | 245 (48.6%) | 115 |
| `platforms` | 240 (47.6%) | 78 |
| `apm` | 170 (33.7%) | 168 |
| `tickets_2024` | 83 (16.5%) | 62 |

**Important:** `quality` inside this file is a QN v2.4.2 projection —
`quality.meta.corpus = "QN_p120826_FULL_2_4_2_RO_270826 · User_Detail"`. It carries a
**time series** (138 weeks / 33 months / 12 quarters / 4 years), 200 recurring patterns and
140 assignment-group quality rows. **Neither the time series nor the population-scale
recurring patterns can be reproduced from the uploaded workbook** — that workbook has no
temporal sheet and its `Short Description` exists only in the sampled detail. This is the
one legitimate second source, resolved by an authority ladder (§25), not a parallel path.

### Source B — uploaded QN workbook (runtime, browser only)

The application's source of truth for the corpus. **No pre-generated JSON is required or
permitted as a production dependency.** `data/` contains exactly one file.

Flow: **upload → validate against the in-code contract → classify scope per sheet → derive
datasets → index detail → analyse.**

| Module | Role |
|---|---|
| `lib/qn/contract.ts` | Sheet and column contract, invariant specs. Declares **shape, never figures** |
| `lib/qn/ingest.worker.ts` | Web Worker: parse (SheetJS), validate, classify scope, derive, write IndexedDB |
| `lib/qn/db.ts` | Read-only IndexedDB access, shared by UI and agent |
| `lib/qn/corpus.tsx` | React provider; `useCorpus`, `useDataset` |
| `lib/qn/types.ts` | `Scope`, `Provenance`, `Dataset`, `CorpusSnapshot`, `IngestProgress` |
| `components/CorpusUpload.tsx` | Upload UI, dataset table, invariant table |
| `components/CorpusAnalysis.tsx` | Analysis over the loaded workbook |

IndexedDB `xops-corpus` v2: stores `meta` (key `"current"` → `CorpusSnapshot`), `datasets`
(keyed by `DatasetId`), `user` and `alert` (keyPath `Number`, indexes `ag_key`, plus
`Label` on user and `ops_class` on alert).

Workbook sheets (verified against `QN_p120826_SAMPLE_2_4_2_RO.xlsx`):

| Sheet | Role | Scope | Rows loaded | What it proves | What it cannot |
|---|---|---|---:|---|---|
| `Overview` | banner | full | — | Declares the population | Nothing at group grain |
| `User_By_Group` | aggregate | **full** | 987 | Group-level incident population metrics | Anything per-ticket |
| `Alert_By_Group` | aggregate | **full** | 315 | Group-level alert population metrics | — |
| `Dual_Axis` | aggregate | **full** | 4 + total | Quality band × close-notes class | Causality |
| `By_Decalogue` | aggregate | **full** | 10 codes | Pattern counts; two distinct measures | Anything about the 87.1% unclassified |
| `Decalogue_By_Group` | aggregate | **unknown** | 969 | Codes per group | Coverage — it declares no denominator |
| `Compliance_CloseNotes` | banner | **full** | 880 | KPI + per-group table | Quality; it measures field population |
| `Compliance_Alerts` | banner | **full** | 336 | Alert documentation rate | — |
| `Decalogue_Validation` | banner | **full** | 60 | v1/v2 A/B matrix | Cross-cut series — blocked |
| `User_Detail` | detail | **sample** | 500 | Inspection, examples | Any population figure |
| `Alert_Detail` | detail | **sample** | 500 | Inspection, examples | Any population figure |
| `User_By_Agent` | **excluded** | — | — | — | Out of scope by decision (HR/Legal) |

**The workbook declares no data cut-off.** Overview cell C1 holds `2026-08-13 14:17`, the
report generation time. The `2026-08-12` cut-off asserted in the older handoff appears
nowhere in the file and has been withdrawn. `snapshot.asOf` is `null` unless an explicit
cut-off is found; `snapshot.generatedAt` carries the timestamp separately.

**The detail sample is not random.** `Closed At` across the 500 user rows spans
`2024-01-02` to `2024-01-20` — the oldest records. Surfaced as an observation next to the
count.

---

## 8. Full Corpus vs Sample

**Scope is a property of the dataset, not of the workbook.** A single file carries sampled
detail and full-population aggregates; marking the whole file "sample" would erase the
distinction exactly where it matters.

Each sheet is proved, never assumed, by one of two tests declared in
`lib/qn/contract.ts`:

- `fullIf` — sum a counting column and compare against the population `Overview` declares.
  Used by `User_By_Group` (Incidents), `Alert_By_Group` (Alerts), and both detail sheets
  (row count).
- `fullIfDeclares` — read a denominator the sheet declares internally. Used by `Dual_Axis`
  (its Total row), `By_Decalogue` (the `/ 277,408` in its Summary block), and the three
  banner sheets (`Total user incidents` / `Total alerts`).

A sheet with no test stays `unknown`. Nothing is assumed full.

**The rule:** never compute a population claim from sampled detail when a full aggregate
exists. Group-level metrics come from `User_By_Group`; they are never recomputed from the
500 detail rows.

Technically: `Provenance.scope` (`"full" | "sample" | "unknown"`) plus `representedRows`
and `scopeEvidence` travel with every dataset, are stored in IndexedDB, surface through
`useDataset(...).scope`, and are rendered by `ScopeChip` in `components/CorpusUpload.tsx`.
Agent tool responses carry the same via `provOf(...)` in `lib/agent/client-tools.ts`.

---

## 9. Evidence Model

Two orthogonal axes, both **IMPLEMENTED** in `types/relationships.ts`.

### Relationship status — `RelationshipStatus`

| Concept | Implemented as | Meaning |
|---|---|---|
| DECLARED | `"declared"` | Explicit in the authoritative source |
| DERIVED | `"derived"` | Reproducible by deterministic traversal over declared edges |
| CORROBORATED | `"corroborated"` | Several independent signals converge; no direct authoritative edge |
| INFERRED | `"inferred"` | A model proposes candidates. Never becomes declared on its own |
| UNKNOWN | `"unknown"` | Evidence supports no credible candidate |
| CONFLICT | `"conflict"` | Authoritative sources disagree. Surfaced, never auto-resolved |
| REQUIRES CONFIRMATION | `RelationshipEdge.requiresConfirmation` | Boolean on the edge |

### Value origin — `ValueOrigin`

| Concept | Implemented as | Meaning |
|---|---|---|
| MEASURED | `"measured"` | Counted directly over the loaded model |
| DERIVED | `"derived"` | Computed by deterministic traversal |
| BUSINESS-CASE BASELINE | `"business_case_baseline"` | From the business case. **Never mixed with measured values** |
| UNAVAILABLE | `"unavailable"` | Required data absent. **Never estimated** |
| HYPOTHESIS | not a `ValueOrigin` | Expressed as prose in §3 and in `incidentAttribution.unlocks`. **PROPOSED** as a first-class state |

`Measured<T>` carries `value`, `origin`, `source`, optional `denominator`, `calculation`,
and `missingEvidence` when unavailable.

Scores use `evidenceScore` and are explicitly documented as **ordinal evidence scores, not
calibrated probabilities** — calling them confidence would itself be an evidence upgrade.

### The central rule

**The system must never silently upgrade evidence.**

- A shared support relationship is not proven ambiguous incident attribution.
- An association is not causality.
- A derived relationship is not a declared relationship.
- A sample is not a population.
- A business-case baseline is not a metric reproduced from the loaded corpus.
- An unavailable measure is not estimated unless an estimation method is defined explicitly.

Enforced by invariants RM09, RM10, RM11 and QN13 (§23).

---

## 10. Reconciled Business-Case Metrics

All rows verified by `npm run relationships` against the loaded model.

| Claim | Business Case | Current Data | Status | Source | Interpretation |
|---|---:|---:|---|---|---|
| Applications | 504 | 504 | **matches** | `applications` | Same universe |
| On >1 platform | 156 | 156 | **matches** | `applications[].platforms` | — |
| No declared relationship | 187 | 187 | **matches** | both arrays empty | Definition recovered from the match: *neither* platform *nor* support group |
| With >1 support group | 123 | **113** | **diverges** | `applications[].ags` | Unresolved. See §11 |
| Teradata direct | 30 | 30 | **matches** | `platforms[].app_ids` | — |
| Power BI direct | 129 | 129 | **matches** | idem | — |
| Databricks direct | 18 | 18 | **matches** | idem | — |
| Teradata total reach | 186 | **184** | **diverges** | traversal §13 | Residual exactly 2 |
| Power BI total reach | 242 | **240** | **diverges** | traversal §13 | Residual exactly 2 |
| Databricks total reach | 148 | **146** | **diverges** | traversal §13 | Residual exactly 2 |
| Incidents in population | 59,963 | — | **not computable** | `tickets_2024` sums 31,193 over 83 apps | Different population and window |
| Ambiguous attribution | 33.7% | — | **not computable** | `meta.incident_link.available = false` | No incident carries an application attribution |
| Median MTTR delta | +16.6 h | — | **not computable** | no `opened_at` anywhere | Invariant QN13 blocks derivation from `Closed At` |
| Diagnostic content | 51.6 → 68.4 | 51.6 → 68.4 | **matches** | `quality.baseline_metrics` | +16.8 pp |
| Root cause | 71.2 → 83.7 | 71.2 → 83.7 | **matches** | idem | +12.5 pp |
| Resolution steps | 87.3 → 92.8 | 87.3 → 92.8 | **matches** | idem | +5.5 pp |
| Poor or Critical | 15.8 → 7.3 | 15.8 → 7.3 | **matches** | idem | −8.5 pp |
| Close-notes compliance | — | 96.1% vs 30% target | measured | `Compliance_CloseNotes` | Saturated |
| High-volume groups GREEN | — | 36 of 36 | measured | compliance × `User_By_Group` | Five of them ≥30% Poor+Critical |
| Compliance ↔ quality correlation | — | r = −0.154 | measured | idem, 36 groups | Absence of relationship |
| Poor+Critical concentration | — | 20 groups = 81.7% | measured | `User_By_Group` | 3 groups = 47.5% |
| Support-route partition | — | 102 / 210 / 192 | measured | AG bridge | Complete partition of 504 |
| Shared support groups | — | 75 of 249 (30.1%) | measured | derived index | Max 42 applications |

---

## 11. Known Reconciliation Issues

### Issue 1 — applications with more than one support group

| | |
|---|---|
| Expected | 123 |
| Reproduced | 113 |
| Source of 113 | `applications[].ags`, all from `ag_source_kind = "bridge"` |
| Investigated | 113 raw entries = 113 canonical keys. **Not** a normalization collapse. Not filtering. Not denominator — both are over 504 |
| Likely explanation | A support relationship the semantic layer does not carry, or a different extract date. The inventory's own Assignment Group column is **capped at 10 entries** (`ag_source_kind = "inventory"`), a plausible source of the difference |
| Resolved | **No** |
| Remaining investigation | Obtain the business case's extraction query and cut-off date; compare the two source columns directly |

### Issue 2 — second-order exposure residual

| | |
|---|---|
| Expected | 186 / 242 / 148 (Teradata / Power BI / Databricks) |
| Reproduced | 184 / 240 / 146 |
| Residual | **Exactly 2 on all three** |
| Source | One-hop traversal, §13 |
| Likely explanation | A constant offset across three platforms of very different size points at a **definitional difference**, not a broken traversal — most likely two applications the business-case traversal reaches through a relationship this model does not carry |
| Resolved | **No** — reported as `diverges` |
| Remaining investigation | Obtain the traversal semantics behind the business-case figures |

A prior version of this comparison was wrong in this repository's own favour: it compared
the business case's *exposed* figure against second-order-only. The like-for-like reading
is total reach. Corrected in `53a86ff`; the residual only became constant after the fix.

---

## 12. Routing Model

**Two distinct analytical layers. The first does not substitute for the second.**

### Layer 1 — relationship routing · **IMPLEMENTED, VALIDATED**

`SupportRouteState` in `types/relationships.ts`, computed in `lib/relationships.ts`:

| State | Count | Share | Meaning |
|---|---:|---:|---|
| `unique_support_route` | 102 | 20.2% | Holds at least one support group no other application shares |
| `shared_support_route` | 210 | 41.7% | Every support group it holds is also served by another application |
| `no_declared_support_route` | 192 | 38.1% | Declares no support group |
| | **504** | **100%** | Complete partition (RM01) |

**What this proves:** for 402 of 504 applications the *declared support relationship alone*
does not yield a unique application route.

**What it does not prove:** that incident attribution is non-deterministic. Other signals
may resolve a given incident — Configuration Item, Service Offering, a Business Application
already on the ticket, process, or other ServiceNow relationships. The naming is
deliberately narrow. **Do not rename these states to `deterministic` / `ambiguous`.**

### Layer 2 — incident attribution · **BLOCKED**

`incidentAttribution` in `lib/relationships.ts`, `available: false`. Both measures are
`origin: "unavailable"` with `value: null`. Invariant RM09 forbids estimating them.

Missing evidence: Incident → Business Application attribution source · `opened_at` ·
`resolved_at`/`closed_at` pair · priority at incident grain · channel · Configuration Item
relationship.

Unlocks once available: how often attribution is ambiguous in practice; whether ambiguity
associates with slower resolution controlling for priority and channel; which evidence
produced each attribution; per-application incident history.

---

## 13. Relationship Graph

### Entities actually supported

| Entity | Source | Count |
|---|---|---:|
| Application | `applications` | 504 |
| Platform | `platforms` | 38 |
| Support group (Assignment Group) | `assignment_groups` / `applications[].ags` | 268 catalogue / **249 in the bridge** |
| Business process | `applications[].process` | 9 distinct |
| Sector | `sectors` | 11 |
| Owner / DPM | `dpm`, `dpm_l3`, `owner`, `tech_lead` | 62 / 29 / 92 / 36 distinct |
| Incident (aggregate only) | QN workbook | 277,408 population; 500 rows loaded |
| Alert (aggregate only) | QN workbook | 442,538 population; 500 rows loaded |

**Not supported as entities:** Configuration Item (absent from every dataset) and Service
Offering (present as a *string field on tickets*, not an entity with relationships).

### Edges

| Edge | Status | Coverage |
|---|---|---|
| Application → Platform | declared | 240 known / 264 missing |
| Application → Support Group | declared (via bridge) | 312 / 192 |
| Application → Business Process | declared | 491 / 13 |
| Application → Owner | declared | 458 / 46 |
| Platform → Application | declared, inverse | — |
| Platform → second-order Application | **derived** | traversal below |
| Incident → Application | **unknown** | no deterministic path (§15) |

### Traversal semantics — verbatim from `lib/relationships.ts`

> platform → applications declaring it → the support groups those applications declare →
> every application those groups serve. One hop through shared responders. Unweighted,
> undirected, no transitive closure beyond the single hop.

| Platform | Direct | Bridging groups | Second-order | Total reach |
|---|---:|---:|---:|---:|
| POWER_BI | 129 | 42 | 111 | 240 |
| ADF | 64 | 36 | 94 | 158 |
| AZURE_PLATFORM | 55 | 42 | 117 | 172 |
| TERADATA | 30 | 31 | 154 | 184 |
| DATABRICKS | 18 | 32 | 128 | 146 |

RM06 guarantees second-order never intersects direct. RM07 guarantees a platform with no
bridging group has no second-order reach.

---

## 14. Relationship Discovery

**DECIDED. Not implemented.** Types exist; no discovery method is written.

When a relationship is missing, shared, or insufficient for a unique route, the system
should look for alternative evidence rather than stopping at `unknown` — while preserving
the distinction between declared, derived, corroborated, inferred and confirmed.

### Evidence escalation

| # | Level | Status |
|---|---|---|
| 1 | Authoritative declared relationship | **IMPLEMENTED** |
| 2 | Deterministic graph traversal | **IMPLEMENTED** (platform second-order) |
| 3 | Exact identifiers / normalized metadata | **PROPOSED** — `agKey` normalizer exists; the SO-suffix rule is measured but unwired |
| 4 | Historical operational behaviour | **PROPOSED** — blocked by the same missing incident→application evidence it would establish |
| 5 | Statistical / graph inference | **PROPOSED** |
| 6 | Semantic similarity / embeddings | **PROPOSED** |
| 7 | LLM-assisted synthesis over collected evidence | **PROPOSED** |

**AI resolves difficult residual cases. It never replaces evidence obtainable
deterministically.** Escalation stops at the first level that yields a unique answer.

---

## 15. Alternative Relationship Signals

Inventoried against the actual data. Coverage figures for ticket-grain signals are measured
on the 500-row sample and are therefore **sample-scoped**; treat them as indicative of
mechanism, not as population rates.

| Relationship | Available signals | Deterministic path | Alternative path | AI/ML opportunity | Evidence strength | Missing data |
|---|---|---|---|---|---|---|
| **Application → Platform** | `platforms` (declared), `technology_raw` (48.6%), `platform_evidence_tier` | Declared on the record | `technology_raw` → keyword normalization (how E3 links were produced) | Entity resolution over `technology_raw` variants; embedding similarity to platform names | authoritative | CI → platform for the 264 with no declared platform |
| **Application → Support Group** | `ags` (declared, bridge), `assignment_groups[].app_ids`, `ag_source_kind`, ticket-grain Assignment Group | Application → Assignment Group bridge | Operational history: which group resolves tickets naming the application; process + sector neighbourhood | Historical co-occurrence frequency; graph neighbourhood similarity | strong | Ticket → application attribution — which is what history would need |
| **Incident → Application** | Assignment Group (100% populated), Service Offering (100%), Short Description (100%), Category | **NONE** | AG → supported apps: **73.4%** of sampled tickets join the model; of those **61.3%** reach exactly one application. SO → app by exact name after stripping the `" - SO"` suffix: **6.4%**, and **unique whenever it fires** (32/32 user, 20/20 alert). Short Description tokens: **74.2%** yield a candidate but **~90% of those are multi-candidate** | Entity extraction over Short Description; retrieval against confirmed cases; classifier trained on tickets whose group already resolves uniquely | moderate | Business Application on the ticket · Configuration Item · `opened_at` |
| **Application → Business Process** | `process` (97.4%, 9 values), `assignment_groups[].processes` | Declared on the record | Application → support group → processes that group serves | **Not warranted** — coverage is already 97.4% over a 9-value vocabulary | authoritative | — |
| **Application → Owner / DPM** | `dpm` (76.0%), `dpm_l3` (56.5%), `owner` (47.2%), `tech_lead` (54.4%), `assignment_groups[].dpms` | Declared on the record | Application → support group → DPMs that group reports | **None.** Inferring a named accountable person from behaviour is not acceptable | authoritative | An owner for the 46 declaring none of the four |
| **Platform → Impacted Applications** | `platforms[].app_ids`, the support-group bridge | Declared, inverse | One-hop traversal through shared groups | None needed; the traversal is deterministic | authoritative | Documented traversal semantics behind the business-case figures |

**Service Offering, in detail.** 100% populated, 171 distinct in the user sample. Raw exact
match to application name: **0%**. After stripping the `" - SO"` suffix: **6.4%**. The
non-matching values are a different namespace — `VMWARE VCENTER PROD`, `PIC MACON DC PROD`,
`SHAREDSERVICES-PCMILER` — i.e. infrastructure/CI-like, not applications. This is a
**low-coverage, high-precision** signal: useless alone, decisive inside an ensemble.

**Signals confirmed absent:** Configuration Item, `opened_at`, resolution duration, ticket
priority joined to time, monitor configuration, suppression state, assignment history.

---

## 16. Relationship Discovery Evaluation

**PROPOSED.** Nothing implemented. No method may enter the product before it is measured.

Ground truth exists: 312 applications have declared support groups and 240 have declared
platforms. Method:

1. Hold out a stratified sample of confirmed relationships.
2. Ask each method independently to recover them.
3. Compare candidates against ground truth.

Metrics: Top-1 accuracy · Top-3 recall · unresolved rate · false-positive rate · coverage ·
calibration **only where the method produces a calibrated probability** (most will not —
report an ordinal evidence score instead).

Evaluate rules, graph traversal, historical behaviour, entity resolution, semantic
retrieval and LLM synthesis **separately, then in combination**. Promote a method only when
measured performance justifies it.

**Prefer an evidence ensemble over one opaque model.** A candidate must be explainable as
*"CI history + resolver-group frequency + Service Offering match"*. `"AI confidence: 92%"`
is not acceptable output. Expose evidence, never hidden reasoning.

---

## 17. Operational Quality

Both sides, in this order.

**1 · Quality has materially improved.** All four reproduce exactly against
`quality.baseline_metrics`:

| Measure | Baseline | Current | Delta |
|---|---:|---:|---|
| Diagnostic content | 51.6% | 68.4% | +16.8 pp |
| Root cause | 71.2% | 83.7% | +12.5 pp |
| Resolution steps | 87.3% | 92.8% | +5.5 pp |
| Poor or Critical | 15.8% | 7.3% | −8.5 pp |

**2 · Remaining defects are concentrated.** 20 assignment groups hold 81.7% of all
Poor + Critical records; three hold 47.5%. A portfolio-wide programme is the wrong response.

**3 · The existing control cannot find them.** All 36 groups with ≥1,000 incidents are
GREEN on close-notes compliance; five have ≥30% Poor + Critical; the corpus-level KPI reads
96.1% against a 30% target. Pearson r across those 36 groups = **−0.154**.

**4 · Same shape as the structural problem.** A populated field does not tell you a
relationship is correct, and a compliance rate does not tell you a route is unique.

**Weak correlation does not establish causality.** r = −0.154 is the absence of a
relationship. Do not write, imply, or let the agent state that compliance causes poor
quality, or that it is useless.

Also measured, full corpus: `By_Decalogue` classifies **35,814 incidents (12.9%)** and
records **39,320 code occurrences** — two different units, overcount 3,506, because one
incident may carry several codes. The UI must never present 39,320 as a population.
Alerts: 48.9% carry no documentation, 48.8% auto-resolved, 32.7% have a root cause.

---

## 18. AI / Agent Role

**Current state — IMPLEMENTED but purposeless.** `/agent` is a standalone route with four
generic suggestion chips and no context from any screen. Nine tools in
`lib/agent/tools.ts`: two server-side over the semantic layer (`application_context`,
`semantic_layer_coverage`) and seven client-side over IndexedDB (`corpus_status`,
`corpus_summary`, `assignment_group_profile`, `decalogue_breakdown`, `lookup_ticket`,
`search_tickets`, `recurring_signatures`). Every client response carries provenance.
Behaviour rules R1–R10 live in `lib/agent/system-prompt.ts`.

**AI should:** connect evidence across datasets · propose candidate relationships with
their evidence · retrieve similar confirmed cases · detect contradictions between sources ·
explain why a candidate exists · answer provenance questions · rank candidates when
evidence supports ranking · state plainly when a measure is blocked and what would unlock it.

**AI should not:** narrate visible charts · invent relationships · promote inferred to
declared · fabricate confidence · present hypotheses as measured facts · convert
correlation into causality.

**DECIDED:** the agent should be reachable *from a finding*, carrying that finding as
context — not a nav destination. This is not a chatbot with dashboards.

---

## 19. Relationship Confirmation Workflow

**DECIDED. Not implemented.**

```
UNKNOWN → EVIDENCE FOUND → CANDIDATE RELATIONSHIP → CORROBORATED
        → HUMAN CONFIRMATION → DECLARED RELATIONSHIP
```

An inferred relationship becomes declared **only** through explicit human/governance
confirmation. AI improves the confirmation workflow; it does not replace it.

A confirmation surface should present: the proposed relationship, why (each piece of
evidence, named), the evidence sources, and status `requires confirmation`. The type system
supports this today — `RelationshipEdge.evidence[]` and `.requiresConfirmation` — with no
writer and no persistence. Note the POC has no backend: persisting confirmations is an
unresolved architectural question (§32).

---

## 20. Relationship Prioritization

**PROPOSED.** Not implemented, not yet approved.

Two axes: **operational value** (how many blocked questions a confirmation unlocks — the
`RelationshipCoverage.blocks` field already lists these per relationship type) and
**evidence strength** (how much supporting evidence already exists).

| | High evidence | Low evidence |
|---|---|---|
| **High value** | Rapid confirmation candidate | Requires owner discovery or new data |
| **Low value** | Batch/automatic candidate | Lower priority |

More useful than a flat "missing relationships" list. Requires §14 discovery to exist first.

---

## 21. Technical Architecture

**Framework:** Next.js 15.5 App Router · React 19 · TypeScript 5.9 (strict) · Tailwind 3.4
· Recharts 3.10 · SheetJS `xlsx` 0.18 · AI SDK `ai` 7 + `@ai-sdk/react` 4 · Zod 4.

**Deployment:** static prerender — **517 routes** (504 from `/app/[app_id]`); `/api/chat` is
the single dynamic route. No database, no auth, no server persistence.

### Modules that matter

| Path | Role |
|---|---|
| `lib/data.ts` | Semantic-layer computation: `computeBlast`, `computeGaps`, `computeSankey`, `neighbourhood`, `filterApps`, `searchApps`, `measureById` |
| `lib/relationships.ts` | **§12–13 relationship model.** `applicationStates`, `supportRoutePartition`, `groupTopology`, `platformTopology`, `relationshipCoverage`, `incidentAttribution`, `businessCaseBaseline`, `reconciliation`, `signalInventory` |
| `types/relationships.ts` | Evidence model (§9) |
| `types/index.ts` | Semantic-layer data contract |
| `lib/qn/*` | Corpus ingestion (§7) |
| `lib/palette.ts` | PepsiCo palette for SVG/Recharts; `contrast()`, `onFill()` |
| `lib/agent/*` | Agent tools, client executor, system prompt |
| `scripts/build_data.py` | Semantic-layer projector, 13 verification checks |
| `scripts/build_qn_aggregates.py` | **Development utility only.** Not a production dependency |
| `scripts/relationship-report.ts` | Relationship model diagnostic + 13 invariants |
| `scripts/verify-acceptance.mjs` | 46 Playwright acceptance assertions |

### Local persistence

IndexedDB `xops-corpus` v2 (§7). `localStorage` key `xog:density` for the portfolio table
density preference. Nothing else persists.

### Palette note

SVG presentation attributes do **not** resolve `var()`. Recharts writes `fill`/`stroke` as
attributes, so anything painting from JavaScript imports constants from `lib/palette.ts`;
the CSS variables in `app/globals.css` are for hand-written CSS and exports.

---

## 22. Important Technical Decisions

| Decision | Rationale |
|---|---|
| **Uploaded Excel is the source of truth** | The user must be able to replace the workbook without regenerating JSON or changing code. A pre-generated aggregate JSON is a second source that silently goes stale |
| **No required pre-generated JSON** | `data/` holds exactly one file. `lib/agent/tools.ts` no longer imports any QN JSON; the aggregate-reading tools moved client-side |
| **Contract in code, not in a generated file** | `lib/qn/contract.ts` declares shape only. **No population is hardcoded** — every figure is read from `Overview` |
| **All corpus processing local** | 719,946 rows must not travel to a server. Web Worker keeps the main thread responsive |
| **Scope per dataset, not per workbook** | One file carries sampled detail and full aggregates. A single flag would erase the distinction (§8) |
| **`ops_class` normalized index field** | IndexedDB rejects a keyPath containing spaces, so an index on `"Ops Classification"` is not constructible. The original column is preserved untouched for provenance; the index runs on the copy. Implementation detail, not a user-facing concept |
| **Provenance attached to every derived value** | `Measured<T>` and `Provenance` make a value without a source unrepresentable |
| **Invariants before presenting verified values** | Structural invariants decide whether the cut-off is stamped; population and semantic invariants mark the datasets they guard as unverified without repairing them |
| **`openExisting()` never creates the database** | The naive `open(DB, N)` resolving null on `onupgradeneeded` leaves an empty database behind, after which the ingest's `onupgradeneeded` never fires and it cannot create its stores. Verified in browser. It also does not pin a version, so a future schema bump does not read as "no corpus" |
| **Authority ladder on `/quality`, not a parallel path** | The semantic layer's embedded QN projection answers the time series and population-scale recurring patterns that the workbook cannot. Uploaded workbook wins wherever it can answer |
| **Agent aggregate tools are client-side** | They read the corpus, which lives in the browser. Only semantic-layer tools stay server-side |
| **`esbuild` for the TS diagnostic script** | Runs `lib/relationships.ts` directly rather than reimplementing it in a `.mjs`, which would create a second source of truth |

---

## 23. Validation and Invariants

### A · Semantic-layer projector — `scripts/build_data.py`

**13 `checks.append(...)` verifications** comparing derived counts against expected values;
prints `VERIFICACION`, exits 1 on any failure. Plus an R4 non-additivity witness
(Teradata ∪ SAP_BW) and a warning listing unresolved AG names.

> Correction: the older `HANDOFF.md` claims 28. The file contains 13.

### B · Corpus ingestion — `lib/qn/contract.ts`, evaluated in `lib/qn/ingest.worker.ts`

| Id | Class | Checks |
|---|---|---|
| QN01 | structural | Every contract sheet present |
| QN02 | structural | Every contract column present per tabular sheet |
| QN03 | population | `User_By_Group` sums to the declared user population |
| QN04 | population | `Alert_By_Group` sums to the declared alert population |
| QN05 | population | user + alert = total, no overlap |
| QN06 | population | `Dual_Axis` Total row equals the user population |
| QN07 | population | Each `Dual_Axis` class column sums to its Total row |
| QN08 | semantic | Ten distinct codes; occurrences exceed classified incidents |
| QN09 | semantic | v1/v2 A/B matrix present, so the cross-cut series stays blocked |
| QN10 | structural | No repeated group name in `User_By_Group` |
| QN11 | semantic | Canonical normalizer collapses no group |
| QN12 | semantic | Close-notes KPI carries its target, never the rate alone |
| QN13 | semantic | **No `opened_at` exists** — time-to-resolve stays blocked |

**Failure behaviour:** structural failures withhold the cut-off stamp (`asOf` stays null).
Population and semantic failures add every dataset they guard to
`snapshot.unverifiedDatasets`, which `useDataset(...).verified` reads. **Failures are never
silently repaired.** Currently 13/13 pass on the sample workbook.

### C · Relationship model — `scripts/relationship-report.ts`

RM01–RM13. Currently **13/13 pass**. Exits 1 on any failure.

| Id | Checks |
|---|---|
| RM01 | Support-route partition complete and disjoint (102 + 210 + 192 = 504) |
| RM02 | Every application carries exactly one route state |
| RM03 | An application with no support group is never marked unique |
| RM04 | An application marked unique holds at least one exclusive group |
| RM05 | An application marked shared holds groups but none exclusive |
| RM06 | Second-order exposure never intersects direct exposure |
| RM07 | A platform with no bridging group has no second-order reach |
| RM08 | Every coverage row sums known + missing to the universe |
| RM09 | **Incident attribution is declared unavailable, never estimated** |
| RM10 | **No business-case figure is presented as measured** |
| RM11 | Declared owners are never invented |
| RM12 | Every shared group really serves more than one application |
| RM13 | Every divergence carries a written reason |

### D · Application acceptance — `scripts/verify-acceptance.mjs`

46 Playwright assertions against a running build. **No expected figure is hand-written** —
every one is derived from the JSON. Currently **46/46 pass**.

---

## 24. Current Implementation Status

| Capability | Status | Evidence | Next step |
|---|---|---|---|
| Semantic-layer projector + 8 dashboard screens | **IMPLEMENTED** | 46/46 acceptance, 517 routes | — |
| PepsiCo palette, full ramp | **IMPLEMENTED** | 11 documented contrast ratios reproduced | — |
| Command palette, drawer, density, deep-link filters | **IMPLEMENTED** | `/portfolio?gate=not-routable` → 192 of 504 | — |
| Agent, 9 tools, AI Gateway | **IMPLEMENTED** | typecheck + build | Seed from context (§30) |
| Corpus upload → validate → scope → index | **IMPLEMENTED, VALIDATED** | 13/13 QN, browser E2E, persists across reload | — |
| Per-dataset scope classification | **IMPLEMENTED, VALIDATED** | 7 sheets full, 2 sample, 2 unknown, 1 excluded | — |
| Corpus analysis screen | **IMPLEMENTED** | renders from the uploaded workbook | Reorder per §17 |
| Relationship model (Step 1) | **IMPLEMENTED, VALIDATED** | 13/13 RM invariants | UI in Step 2 |
| Business-case reconciliation | **IMPLEMENTED, VALIDATED** | `npm run relationships` | Resolve §11 |
| Evidence model types | **IMPLEMENTED** | `types/relationships.ts` | Wire into UI |
| Incident attribution layer | **BLOCKED** | `available: false` | §28 |
| Narrative architecture | **DECIDED** | §4 | Steps 2–5 |
| Question-driven navigation | **DECIDED** | §6 | Step 5 |
| Landing page as argument | **DECIDED** | §4, §5 | Step 2 |
| Second-order exposure in UI | **DECIDED** | model exists | Step 3 |
| Relationship discovery | **DECIDED** (design), **PROPOSED** (methods) | §14–16 | After Steps 2–4 |
| Discovery evaluation harness | **PROPOSED** | §16 | Before promoting any method |
| Confirmation workflow | **DECIDED**, unimplemented | §19 | Needs a persistence answer |
| Prioritization matrix | **PROPOSED** | §20 | After discovery |
| `HYPOTHESIS` as a `ValueOrigin` | **PROPOSED** | §9 | Add with Step 2 |
| `scripts/build_qn_aggregates.py` | **IMPLEMENTED** — dev utility only | Not imported by app code | Keep out of the build |
| Endpoint protection for `/api/chat` | **BLOCKED** on a deployment decision | Public today | §28 |

---

## 25. What Has Been Rejected or Superseded

| Rejected approach | Why |
|---|---|
| **Manually generated `QN_v242_aggregates.json` as a production dependency** | Broke the preview deployment at compile time, and made the app depend on a step the user must remember. **The import is removed. Do not reintroduce it.** `scripts/build_qn_aggregates.py` survives as a dev utility only |
| **Treating the workbook as a single `complete: false`** | Erases the distinction between full aggregates and sampled detail exactly where it matters. Replaced by per-dataset scope with a coverage test each |
| **Deriving population metrics from the 500-row detail** | The sample is date-ordered (`2024-01-02` to `2024-01-20`), not random. Group metrics come from `User_By_Group` |
| **Calling shared support groups "ambiguous incident attribution"** | Overstates the evidence. Other signals may resolve a given incident. Terminology corrected to `unique/shared/no_declared_support_route` |
| **Using the support-route partition as a substitute for the 33.7% figure** | They are related but different metrics. Layer 1 does not stand in for Layer 2 |
| **Documentation quality as the product thesis** | Valid finding, wrong altitude. It is Level 4 supporting evidence (§17) |
| **Framing compliance as "useless" or causal** | r = −0.154 is absence of relationship. Correct framing: saturated, therefore weak as a discriminator |
| **Presenting the MTTR association as demonstrated saving** | It is an association, and one this corpus cannot even reproduce |
| **Reporting second-order exposure as reconciled** | The mechanism validates; the population does not. Residual of exactly 2 is unexplained |
| **Silently choosing 113 over 123** | Both preserved with provenance. Neither is marked correct |
| **Stamping `2026-08-12` as the data cut-off** | It appears nowhere in the workbook. Overview C1 is the report generation time |
| **Using AI to fabricate missing relationships** | Inferred never becomes declared without human confirmation |
| **Building UI before validating the analytical model** | Step 1 deliberately shipped with no UI so the model could be inspected first |
| **`/quality` as two parallel paths** | Resolved as one authority ladder |
| **The whole of the earlier narrative diagnosis** | **SUPERSEDED** by the business-case realignment. Its compliance finding survives at Level 4 |

---

## 26. UI / Copy Principles

The product communicates through data, labels and provenance — not prose.

**Prefer:** `277,408 incidents` · `500 detail records loaded` · `Full corpus` · `Sample` ·
`Source: User_By_Group` · `Not calculated` · `Insufficient data` · `Cut-off not declared by
the workbook` · explicit states · concise technical terminology.

**Avoid:** AI-generated sounding paragraphs · marketing language · generic "insights" ·
chart narration · fabricated confidence · decorative wording · explanatory text
compensating for technical complexity.

Interface in English. Code comments in Spanish, unaccented, matching `lib/` and `scripts/`.
Never state a figure without its denominator (R3).

---

## 27. Current Product Narrative

North star for the next session:

```
The portfolio is modelled as 504 records
  → operations run on relationships, and they are plural
      156 on >1 platform · 113 with >1 support group
  → a third of the portfolio declares no relationship at all
      187 with neither platform nor support group
  → where relationships exist they are mostly not exclusive
      75 of 249 groups shared; the most shared serves 42
  → so for 402 of 504 the declared support route alone is not unique
      102 unique · 210 shared · 192 none
  → what non-uniqueness costs at incident grain is a DECLARED GAP
      no opened_at, no incident→application attribution; unlock condition named
  → second-order exposure is the consequence a list cannot show
      Teradata 30 direct → 184 total reach through shared responders
  → and formal completion does not substitute for it
      36 of 36 high-volume groups GREEN; r = −0.154; quality improving −8.5 pp
  → evidence: the records, groups and examples behind each figure
  → missing relationships, ranked by exposure unlocked and questions unblocked
  → candidate evidence where discovery can propose one
  → human confirmation
  → decision: which relationships to confirm, and by whom
```

---

## 28. Current Blockers

| Blocker | Why it matters | Missing | Alternate path | Unblocked by |
|---|---|---|---|---|
| **Incident-grain extract absent** | Blocks Level 4 entirely: the 33.7% ambiguity figure, the MTTR association, per-application incident history, and any historical-behaviour discovery method | Incident → Business Application attribution · `opened_at` · `resolved_at` · priority · channel · CI | **None.** The support-route partition is portfolio evidence, not a substitute | One extract at incident grain from ServiceNow |
| **123 vs 113 unreconciled** | A headline structural figure disagrees with the business case | Extraction query and cut-off behind the 123 | Both preserved with provenance | The business case's own query |
| **Second-order residual of 2** | Prevents reporting the exposure model as reconciled | Traversal semantics behind the business-case figures | Report as `diverges`, which is what happens today | Documented traversal definition |
| **`/api/chat` is public** | Each invocation costs money | A deployment decision | `MAX_MESSAGES = 40` is the only guard | Vercel Authentication, then an IP limit |
| **Confirmation workflow has nowhere to persist** | §19 cannot complete in a static POC | A persistence decision that does not break the no-backend constraint | — | An explicit architectural decision (§32) |
| **Gateway model slug unverified** | `anthropic/claude-sonnet-4.6` was never confirmed; egress to `vercel.com` is blocked in the dev container | Access to the Gateway catalogue | — | Confirm before deploying |

Not blockers, merely unimplemented: navigation regrouping, landing page rewrite,
second-order UI, discovery methods, prioritization.

---

## 29. Next Implementation Step

**Where we stopped.** Step 1 — the relationship model — is complete, validated, committed
in `53a86ff` and pushed. `npm run relationships` prints the diagnostic and passes 13/13.
The user was shown the output and asked whether to review the model before Step 2, or to
begin discovery via the AG → application path.

**No answer was recorded. Start by asking which.**

Step 1 delivered exactly its approved scope: type definitions, computed model, provenance,
reconciliation checks, invariants, and a compact diagnostic output. **No UI.**

**The next step is Step 2: the landing page as the argument** — unless the user directs
otherwise.

- **Files expected to change:** `components/Overview.tsx`, `app/page.tsx`; possibly a new
  component for the support-route partition figure. Read from `lib/relationships.ts`; do
  not recompute.
- **Intended output:** the seven-band hierarchy of §4/§5 — structural statement, the
  102/210/192 partition as the anchor, why relationships are plural, one worked exposure
  example, the declared Level 4 gap, the quality improvement, and four entry points.
- **Tests required:** `npm run typecheck`, `npm run build`, `npm run verify` (46/46 must
  still pass — `/` is exercised by C5 and C6, which iterate all eight routes, and by B1–B3,
  which read the overview directly), `npm run relationships` (13/13).
- **Do NOT implement yet:** relationship discovery methods, the confirmation workflow, the
  prioritization matrix, navigation regrouping, or any inference. Do not add charts that do
  not close a named narrative gap.

---

## 30. Recommended Next 5 Steps

### Step 2 — Landing page as the argument

- **Objective:** the landing page states the structural problem and its size before any KPI.
- **Why now:** the model exists and is invisible. This is the largest narrative gain per line changed.
- **Files:** `components/Overview.tsx`, `app/page.tsx`, `lib/relationships.ts` (read only).
- **Expected output:** seven bands per §4; the partition as anchor; the Level 4 gap stated on the page.
- **Validation:** typecheck · build · 46/46 acceptance · 13/13 relationship invariants · render and read it.
- **Stop when:** a reader reaches "what should I investigate next" without scrolling past the fold twice. Do not touch navigation.

### Step 3 — Second-order exposure on Blast Radius

- **Objective:** show direct, bridging groups, and second-order reach with the traversal named.
- **Why now:** the clearest demonstration that a graph beats a list; `platformTopology` already computes it.
- **Files:** `components/BlastRadius.tsx`.
- **Expected output:** three numbers plus the path between them; the residual-of-2 divergence visible where the business-case figure is referenced.
- **Validation:** 46/46 must still pass (C1/C1b assert deduplication) · visual check on Teradata 30 → 184.
- **Stop when:** direct and second-order are visually distinct and the traversal is stated. No new chart types.

### Step 4 — Routing state replaces coverage percentages

- **Objective:** the four chain-link cards show route states instead of one "61.9% routable" bar.
- **Why now:** that single number averages away the distinction the product exists to make.
- **Files:** `components/CoverageCard.tsx`, `components/PortfolioTable.tsx`, `app/portfolio/page.tsx`.
- **Expected output:** unique / shared / none per link, with `RelationshipCoverage.blocks` naming what each gap blocks.
- **Validation:** 46/46 — assertions read coverage text on `/portfolio`; adjust the interface, never the assertion.
- **Stop when:** no screen shows a routing coverage percentage without its state breakdown.

### Step 5 — Question-driven navigation and quality reorder

- **Objective:** regroup the nav into the six domains of §6; lead `/quality` with the improvement.
- **Why now:** structural, and safe once Steps 2–4 give the domains real content.
- **Files:** `components/Nav.tsx`, `components/CommandPalette.tsx`, `app/quality/page.tsx`, `components/CorpusAnalysis.tsx`.
- **Expected output:** six domains; Evidence stays a drawer; quality section ordered improvement → concentration → saturated control.
- **Validation:** 46/46 · every route still reachable · palette actions still resolve.
- **Stop when:** navigation names questions, not tables. Do not delete any route.

### Step 6 — Relationship discovery, deterministic tier only

- **Objective:** implement escalation levels 1–3 and the evaluation harness. **No AI yet.**
- **Why now:** measure the deterministic ceiling before any model is allowed near it.
- **Files:** new `lib/discovery/` — candidate generation from AG → application and the Service-Offering suffix rule; new `scripts/discovery-eval.ts`.
- **Expected output:** candidates carrying `RelationshipStatus` and `EvidenceItem[]`; a held-out evaluation reporting Top-1, Top-3, unresolved and false-positive rates per method.
- **Validation:** ground truth = the 312 declared support relationships and 240 declared platforms; results reproducible via an npm script.
- **Stop when:** the deterministic ceiling is measured and published. **Do not promote any method into the UI, and do not add semantic or LLM methods, until this number exists.**

---

## 31. Do Not Re-Litigate

Treat as established unless the repository or new data contradicts them. If something does
contradict, **surface the conflict — do not silently override either side.**

1. The uploaded Excel is the source of truth. No pre-generated JSON as a production dependency.
2. Scope is per dataset, proved by a coverage test, never assumed.
3. Population metrics never come from sampled detail when a full aggregate exists.
4. `unique/shared/no_declared_support_route` — do not rename to deterministic/ambiguous.
5. Relationship routing and incident attribution are separate layers; neither substitutes for the other.
6. MTTR is blocked. Never derived from `Closed At`. QN13 enforces this.
7. The workbook declares no cut-off; `2026-08-12` is withdrawn.
8. Business-case baselines never mix with measured values.
9. Disagreements are preserved with provenance; no value is silently chosen.
10. Operational Quality is Level 4 supporting evidence, not the thesis.
11. Compliance is saturated, therefore a weak discriminator. Not useless, not causal.
12. `User_By_Agent` is out of scope pending an HR and Legal decision.
13. Inferred never becomes declared without human confirmation.
14. The POC is static: no database, no auth, no server-side corpus.
15. Interface in English; code comments in Spanish.

---

## 32. Open Questions

1. **Where do confirmed relationships persist?** §19 requires writing confirmations, and the
   POC has no backend. IndexedDB makes them per-browser and unshareable. Unresolved.
2. **What produced the business case's 123?** Needed to close §11 Issue 1.
3. **What traversal produced 186 / 242 / 148?** Needed to close §11 Issue 2.
4. **Is the incident-grain extract obtainable, and on what timeline?** Determines whether
   Level 4 is a temporary gap or a permanent product boundary.
5. **Should `HYPOTHESIS` become a first-class `ValueOrigin`?** Currently prose only.
6. **Should the semantic layer's embedded QN projection eventually be retired** if a
   workbook ever ships a temporal sheet?
7. **What is the POC's organisational cost?** §3 requires it; no artefact available to this
   session documents it.
8. **Which branch is authoritative?** The older `HANDOFF.md` names
   `claude/xops-operational-graph-poc-2ycnay`; all work since has gone to
   `claude/handoff-qn-data-setup-pi5neu`.

---

## 33. Files and Artifacts

| Artifact | Location | Contents |
|---|---|---|
| This handoff | `PROJECT_HANDOFF.md` | Continuation contract |
| Older handoff | `HANDOFF.md` | Predates the business-case realignment. §1 contract rules valid; narrative **SUPERSEDED**; its "28 invariants" claim is wrong (13) |
| Semantic layer data | `data/xops-operational-graph-data.json` | 504 apps, 38 platforms, 268 groups, 11 sectors, embedded QN quality projection |
| Semantic layer source | *not versioned* | `XOps_Operational_Graph_Semantic_Layer_v3.xlsx` |
| QN corpus source | *not versioned* | `QN_p120826_SAMPLE_2_4_2_RO.xlsx` — 12 sheets, full aggregates, 500+500 sampled detail |
| Relationship model | `lib/relationships.ts`, `types/relationships.ts` | Step 1 |
| Corpus ingestion | `lib/qn/` | contract, worker, db, provider, types |
| Agent | `lib/agent/` | tools, client executor, system prompt |
| Projectors | `scripts/build_data.py`, `scripts/build_qn_aggregates.py` | The second is a dev utility only |
| Diagnostics | `scripts/relationship-report.ts`, `scripts/verify-acceptance.mjs` | 13 RM invariants, 46 acceptance assertions |
| Narrative diagnosis v1 | https://claude.ai/code/artifact/50657a24-e249-4799-8f2e-bf90c95eaf0f | **SUPERSEDED.** Compliance-anchored |
| Narrative diagnosis v2 | https://claude.ai/code/artifact/eab8b32d-ee74-4dfd-862d-1f42ae0ded40 | Current. Business-case aligned, full reconciliation |

---

## 34. Commands

```bash
npm install                 # dependencies

npm run dev                 # development server
npm run build               # production build — 517 routes
npm run typecheck           # tsc --noEmit
npm run lint

npm run relationships       # relationship model diagnostic + 13 RM invariants; exits 1 on failure

# 46 acceptance assertions — requires a running build and an ad hoc Playwright install
npm run build
npx next start -p 3100 &
npm i -D playwright --no-save
npm run verify              # BASE=http://localhost:3100 by default; override with BASE=
```

**Development-only utilities — not production dependencies:**

```bash
npm run data                # python3 scripts/build_data.py — reprojects the semantic-layer xlsx
npm run qn -- WORKBOOK.xlsx # python3 scripts/build_qn_aggregates.py — debugging only.
                            # The application does NOT read its output. Do not reintroduce
                            # data/QN_v242_aggregates.json as an import.
```

**Two operational cautions.**

1. **Kill every stale `next` process before verifying.** An old `next start` serving a
   previous build returns 400 on static assets and produces ghost failures that look like
   regressions. `pkill -9 -f next` first. This cost a debugging cycle once already.
2. **Playwright is not in `devDependencies`.** Installing any package with `--save` prunes
   it. Reinstall with `npm i -D playwright --no-save` before `npm run verify`.

---

# Instructions for the Next Claude Code Session

Read this handoff before anything else, then inspect the repository. Verify that the
implementation state documented in §24 still matches the code — check `lib/relationships.ts`,
`lib/qn/`, and the routes in `app/` — and run `npm run relationships` and `npm run verify`
to confirm the invariants still pass. If the repository contradicts this document, trust the
repository and say what changed.

Do not assume any business-case figure is reproducible from the loaded data. §10 records
exactly which reproduce and which do not; three cannot be computed at all. If you find
yourself about to print 33.7% or +16.6 h as a measured value, stop — those are baselines.

Preserve the evidence boundaries. Do not upgrade inferred to declared, sample to population,
association to causality, or a shared support relationship to ambiguous incident attribution.
The invariants in §23 exist to catch this; do not weaken them to make a screen render.

Do not restart product discovery. The narrative architecture in §4 and the thesis in §2 are
approved. §31 lists what not to re-litigate. Continue from §29 — and note that the user was
asked whether to review the model or begin discovery, and did not answer; ask before
choosing.

Before any major architectural change, explain why the existing decision no longer holds and
get agreement. Preserving a disagreement with the business case is correct behaviour, not a
defect to fix.
