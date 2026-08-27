"use client";
import { useMemo, useState } from "react";
import {
  quality, GRANULARITIES, TOTAL_AGS, UNIVERSE, meta, platforms, getAg,
} from "@/lib/data";
import type { Granularity, QualityAgRow, QualityMetricKey } from "@/types";
import { Metric, InlineMetric } from "@/components/Metric";
import { Delta } from "@/components/Delta";
import { Note, SectionHeader, TableCaption } from "@/components/SectionHeader";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { ApproxTag } from "@/components/Chips";
import { QualitySeries, DecalogueChart } from "@/components/QualityCharts";

/* Readable name and unit for each metric. There is a single canonical scorer,
   QN v2.4.2. Nothing on this screen mixes instruments. */
const METRICS: { key: QualityMetricKey; label: string; unit: "pp" | "pts"; hint: string }[] = [
  { key: "diagnostic_rate", label: "Diagnostic rate", unit: "pp", hint: "Incidents with both a root cause and resolution documentation." },
  { key: "has_root_rate", label: "With root cause", unit: "pp", hint: "Root Cause > 0." },
  { key: "has_res_rate", label: "With resolution docs", unit: "pp", hint: "Resolution Docs > 0." },
  { key: "avg_score", label: "Average QN v2.4.2 score", unit: "pts", hint: "Score from the canonical scorer, 0–100." },
  { key: "poor_critical_rate", label: "Poor documentation on criticals", unit: "pp", hint: "Low band over critical-priority incidents." },
  { key: "reopen_rate", label: "Reopen rate", unit: "pp", hint: "Incidents reopened." },
];
const LABEL = Object.fromEntries(METRICS.map((m) => [m.key, m.label])) as Record<string, string>;

type AgSortKey = keyof Omit<QualityAgRow, "name" | "ag_key">;

export function QualityModule() {
  const qm = quality.meta;
  const [gran, setGran] = useState<Granularity>("month");
  const [metric, setMetric] = useState<QualityMetricKey>("diagnostic_rate");
  const [agSort, setAgSort] = useState<AgSortKey>("incidents");
  const [agAsc, setAgAsc] = useState(false);
  const [minIncidents, setMinIncidents] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [patternLimit, setPatternLimit] = useState(25);

  const points = quality.timeseries[gran];
  const active = METRICS.find((m) => m.key === metric)!;

  const agRows = useMemo(() => {
    const rows = quality.by_assignment_group.filter((r) => r.incidents >= minIncidents);
    const dir = agAsc ? 1 : -1;
    return [...rows].sort((a, b) => (a[agSort] - b[agSort]) * dir);
  }, [agSort, agAsc, minIncidents]);

  /* SOP candidates: high volume and low diagnostic rate. The criterion is stated
     with both of its thresholds, computed from the observed distribution. */
  const sopCandidates = useMemo(() => {
    const rows = quality.by_assignment_group;
    const sortedVol = [...rows].map((r) => r.incidents).sort((a, b) => a - b);
    const volCut = sortedVol[Math.floor(sortedVol.length * 0.6)] ?? 0;
    const sortedDiag = [...rows].map((r) => r.diagnostic_rate).sort((a, b) => a - b);
    const diagCut = sortedDiag[Math.floor(sortedDiag.length * 0.4)] ?? 0;
    return {
      volCut, diagCut,
      rows: rows
        .filter((r) => r.incidents >= volCut && r.diagnostic_rate <= diagCut)
        .sort((a, b) => b.incidents - a.incidents),
    };
  }, []);

  const patterns = quality.recurring_patterns;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-pep-900">Work Notes Quality</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-700">
          How well the work that gets resolved is documented. Quality is measured over the incident corpus
          per Assignment Group, with a single canonical scorer and an eligibility rule written down before
          the baseline was fixed.
        </p>
        <p className="num subtle mt-1">
          {qm.corpus} · cut-off {qm.as_of} · instrument {qm.instrument}
        </p>
      </header>

      {/* ---------- R6 · la elegibilidad es parte de la metrica ---------- */}
      <section className="card card-pad">
        <SectionHeader kicker="R6 · denominator" title="Corpus and eligibility rule">
          <EvidenceBadge tier="E3" showAuthority />
        </SectionHeader>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Eligible incidents"
            resolved={qm.eligible}
            universe={qm.universe_raw}
            unitLabel="of the raw corpus"
          />
          <Metric
            label="AG keys joined to the corpus"
            resolved={qm.join_coverage.ags_matched}
            universe={qm.join_coverage.ags_bridge}
            unitLabel="distinct keys in the model"
            tone="gap"
          />
          <Metric
            label="Applications reached by the measurement"
            resolved={qm.join_coverage.apps_reached}
            universe={qm.join_coverage.apps_universe}
            unitLabel="through their AGs"
            tone="gap"
          />
          <Metric
            label="Platforms reached"
            resolved={qm.join_coverage.platforms_reached}
            universe={qm.join_coverage.platforms_universe}
            unitLabel="through their AGs"
          />
        </div>
        <div className="mt-3 space-y-2">
          <Note>
            <strong>Eligibility rule:</strong> {qm.eligibility_rule}
          </Note>
          <Note tone="warn">
            <strong>Effect of the rule:</strong> {qm.eligibility_effect}
          </Note>
          <Note>
            <strong>Quality rule:</strong> {qm.quality_rule}
          </Note>
          <Note tone="warn">
            <strong>Join reach:</strong> {qm.join_note} These are two distinct catalogues, not one nested in
            the other: the corpus carries <span className="num font-semibold">{qm.join_coverage.ags_quality}</span>{" "}
            groups and the model <span className="num font-semibold">{TOTAL_AGS}</span> names that collapse into{" "}
            <span className="num font-semibold">{qm.join_coverage.ags_bridge}</span> distinct keys (see DQ1).
            Only <span className="num font-semibold">{qm.join_coverage.ags_matched}</span> keys appear in both;
            the joined corpus covers{" "}
            <span className="num font-semibold">{qm.join_coverage.incident_coverage_pct.toFixed(1)}%</span> of the
            eligible incidents. Any quality attributed to an application or a platform is an approximation{" "}
            <ApproxTag /> and it is labelled that way on every other screen.
          </Note>
        </div>
      </section>

      {/* ---------- R7 · un solo instrumento, y el desacuerdo declarado ---------- */}
      <section className="card card-pad">
        <SectionHeader kicker="R7 · single instrument" title="Canonical scorer QN v2.4.2">
          <button type="button" className="btn" onClick={() => setShowWarning((v) => !v)} aria-expanded={showWarning}>
            {showWarning ? "Hide" : "Show"} disagreement between instruments
          </button>
        </SectionHeader>
        <p className="text-sm text-ink-700">
          Every figure on this screen comes from {qm.instrument}. Instruments are never averaged together
          and never swapped depending on which one looks better.
        </p>
        {showWarning ? (
          <div className="mt-3 space-y-3">
            <Note tone="warn">{qm.instrument_warning}</Note>
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-ink-200 bg-ink-50">
                  <tr>
                    <th className="th">Band</th>
                    <th className="th text-right">QN v2.4.2 (canonical)</th>
                    <th className="th text-right">Binary rule from the xlsx</th>
                    <th className="th text-right">Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {qm.band_divergence.map((b) => (
                    <tr key={b.band} className="row-hover">
                      <td className="td font-medium">{b.band}</td>
                      <td className="num td text-right">{b.qn_v242.toFixed(1)}</td>
                      <td className="num td text-right">{b.binary_xlsx.toFixed(1)}</td>
                      <td className="num td text-right">{(b.qn_v242 - b.binary_xlsx > 0 ? "+" : "")}{(b.qn_v242 - b.binary_xlsx).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      {/* ---------- R8 · linea base posterior al quiebre ---------- */}
      <section className="card card-pad">
        <SectionHeader
          kicker={`R8 · baseline ${qm.baseline_window[0]} → ${qm.baseline_window[1]} · current ${qm.current_window[0]} → ${qm.current_window[1]}`}
          title="Movement against the baseline"
        />
        <Note tone="warn">{qm.break_note}</Note>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quality.baseline_metrics.map((b) => (
            <div key={b.key} className="rounded border border-ink-200 p-3">
              <div className="label">{LABEL[b.key] ?? b.key}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="num text-xl font-semibold text-pep-900">{b.current.toFixed(1)}</span>
                <span className="subtle num">from {b.baseline.toFixed(1)} {b.unit === "pts" ? "pts" : "%"}</span>
              </div>
              <div className="mt-1.5">
                <Delta value={b.delta} direction={b.direccion_deseada} unit={b.unit} />
              </div>
              <p className="subtle mt-1.5">
                Desired direction: {b.direccion_deseada === "up_is_good" ? "upwards" : "downwards"}. The colour
                reads the direction, not the sign.
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- serie temporal ---------- */}
      <section className="card card-pad">
        <SectionHeader kicker="Series" title="Quality over time">
          <div className="flex flex-wrap items-center gap-1">
            {GRANULARITIES.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setGran(g.key)}
                className={`btn ${gran === g.key ? "btn-active" : ""}`}
                aria-pressed={gran === g.key}
              >
                {g.label} <span className="num opacity-70">{g.periods}</span>
              </button>
            ))}
          </div>
        </SectionHeader>

        <div className="mb-3 flex flex-wrap items-center gap-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={`btn ${metric === m.key ? "btn-active" : ""}`}
              aria-pressed={metric === m.key}
            >
              {m.label}
            </button>
          ))}
        </div>

        <p className="subtle mb-2">
          {active.hint} The pale bar is the incident volume of the period: the rate is never shown without its
          denominator. The shaded band is the baseline window, which starts after the 2025Q3 change of practice.
        </p>

        <QualitySeries
          points={points}
          metricKey={metric}
          metricLabel={active.label}
          baselineFrom={qm.baseline_window[0]}
          baselineTo={qm.baseline_window[1]}
          unit={active.unit}
        />
        <p className="subtle mt-2 num">
          {points.length} periods at {GRANULARITIES.find((g) => g.key === gran)?.label.toLowerCase()} granularity.
          Periods with very few incidents are shown as they are, with no smoothing and no truncation.
        </p>
      </section>

      {/* ---------- ranking por AG ---------- */}
      <section className="card card-pad">
        <SectionHeader
          kicker={`${quality.by_assignment_group.length} groups with an eligible corpus`}
          title="Quality by Assignment Group"
        >
          <label className="flex items-center gap-2 text-xs text-ink-700">
            Minimum incidents
            <select
              className="input w-28"
              value={minIncidents}
              onChange={(e) => setMinIncidents(Number(e.target.value))}
            >
              {[0, 100, 500, 1000, 5000].map((v) => (
                <option key={v} value={v}>{v === 0 ? "no filter" : v.toLocaleString("en-US")}</option>
              ))}
            </select>
          </label>
        </SectionHeader>

        <Note>
          Only groups with an eligible corpus are listed.{" "}
          <InlineMetric resolved={agRows.length} universe={quality.by_assignment_group.length} /> pass the selected
          minimum. Groups without a corpus are absent here because they have no measurement — not because they
          are doing well.
        </Note>

        <div className="mt-3 scroll-thin max-h-[520px] overflow-auto">
          <table className="w-full border-collapse">
            <TableCaption>
              Every rate is computed over the <span className="num">Incidents</span> column of its own row.
              The denominators differ per group, so the rates can be compared but never averaged.
              The score comes from {qm.instrument}, in points out of 100.
            </TableCaption>
            <thead className="sticky top-0 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Assignment Group</th>
                {([
                  ["incidents", "Incidents"],
                  ["diagnostic_rate", "Diagnostic rate"],
                  ["has_root_rate", "With root cause"],
                  ["avg_score", "QN v2.4.2 score"],
                  ["poor_rate", "Poor docs"],
                ] as [AgSortKey, string][]).map(([k, lbl]) => (
                  <th key={k} className="th text-right">
                    <button
                      type="button"
                      className="hover:text-pep-900"
                      onClick={() => { if (agSort === k) setAgAsc((v) => !v); else { setAgSort(k); setAgAsc(false); } }}
                    >
                      {lbl} {agSort === k ? (agAsc ? "▲" : "▼") : ""}
                    </button>
                  </th>
                ))}
                <th className="th text-right">Apps it serves</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {agRows.map((r) => {
                const g = getAg(r.name);
                return (
                  <tr key={r.ag_key} className="row-hover">
                    <td className="td font-medium">{r.name}</td>
                    <td className="num td text-right">{r.incidents.toLocaleString("en-US")}</td>
                    <td className="num td text-right">{r.diagnostic_rate.toFixed(1)}%</td>
                    <td className="num td text-right">{r.has_root_rate.toFixed(1)}%</td>
                    <td className="num td text-right">{r.avg_score.toFixed(1)}</td>
                    <td className="num td text-right">{r.poor_rate.toFixed(1)}%</td>
                    <td className="num td text-right text-ink-500">
                      {g ? g.app_count : <span className="text-ink-400">not joined to the model</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- candidatos a SOP ---------- */}
      <section className="card card-pad">
        <SectionHeader
          kicker={`${sopCandidates.rows.length} groups meet both thresholds`}
          title="SOP candidates"
        />
        <Note>
          Declared criterion: volume in the top <span className="num">40%</span>
          (≥ <span className="num">{sopCandidates.volCut.toLocaleString("en-US")}</span> incidents) and diagnostic
          rate in the bottom <span className="num">40%</span>
          (≤ <span className="num">{sopCandidates.diagCut.toFixed(1)}%</span>). Both cuts come from the observed
          distribution, not from a threshold picked by hand. High volume that is poorly documented is where a
          standard procedure pays off first; this is not a list of culprits.
        </Note>
        <div className="mt-3 scroll-thin max-h-[360px] overflow-auto">
          <table className="w-full border-collapse">
            <TableCaption>
              Rates over the <span className="num">Incidents</span> column of each row. Membership of this list
              is decided by the two thresholds declared above, not by the value of a single column.
            </TableCaption>
            <thead className="sticky top-0 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Assignment Group</th>
                <th className="th text-right">Incidents</th>
                <th className="th text-right">Diagnostic rate</th>
                <th className="th text-right">Score</th>
                <th className="th text-right">Poor docs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {sopCandidates.rows.map((r) => (
                <tr key={r.ag_key} className="row-hover">
                  <td className="td font-medium">{r.name}</td>
                  <td className="num td text-right">{r.incidents.toLocaleString("en-US")}</td>
                  <td className="num td text-right">{r.diagnostic_rate.toFixed(1)}%</td>
                  <td className="num td text-right">{r.avg_score.toFixed(1)}</td>
                  <td className="num td text-right">{r.poor_rate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- decalogo ---------- */}
      <section className="card card-pad">
        <SectionHeader kicker={`Covers ${qm.decalogue_coverage_pct.toFixed(1)}% of the corpus`} title="Decalogue" />
        <Note tone="warn">
          Only <span className="num font-semibold">{qm.decalogue_coverage_pct.toFixed(1)}%</span> of the eligible
          incidents carry a Decalogue code. The <span className="num">No code</span> category is drawn in the chart
          instead of being excluded: it is the largest category, and hiding it would make the classification look
          better than it is.
        </Note>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <DecalogueChart rows={quality.by_decalogue} />
          <div className="scroll-thin max-h-[280px] overflow-auto">
            <table className="w-full border-collapse">
              <TableCaption>
                Rates over the <span className="num">Incidents</span> column of each code. The column adds up to
                the eligible corpus, {qm.eligible.toLocaleString("en-US")} incidents.
              </TableCaption>
              <thead className="sticky top-0 border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="th">Code</th>
                  <th className="th text-right">Incidents</th>
                  <th className="th text-right">Score</th>
                  <th className="th text-right">Diagnostic rate</th>
                  <th className="th text-right">AGs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {quality.by_decalogue.map((d) => (
                  <tr key={d.dcode} className="row-hover">
                    <td className="td font-medium">{d.dcode}</td>
                    <td className="num td text-right">{d.incidents.toLocaleString("en-US")}</td>
                    <td className="num td text-right">{d.avg_score.toFixed(1)}</td>
                    <td className="num td text-right">{d.diagnostic_rate.toFixed(1)}%</td>
                    <td className="num td text-right">{d.ags.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---------- patrones recurrentes ---------- */}
      <section className="card card-pad">
        <SectionHeader kicker={`${patterns.length} recurring signatures`} title="Repeated patterns" />
        <Note>
          Normalized signatures of the incident text. A signature with many incidents concentrated in a single AG
          is repeated work with a clear owner; spread across many AGs, it is a shared symptom with no owner.
          The signature is a derivation from free text, not a captured field.{" "}
          <EvidenceBadge tier="E3" showAuthority />
        </Note>
        <div className="mt-3 scroll-thin max-h-[420px] overflow-auto">
          <table className="w-full border-collapse">
            <TableCaption>
              The diagnostic rate of each row is computed over the <span className="num">Incidents</span> column
              {" "}of that signature, not over the whole corpus.
            </TableCaption>
            <thead className="sticky top-0 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Signature</th>
                <th className="th text-right">Incidents</th>
                <th className="th text-right">AGs</th>
                <th className="th">Top AG</th>
                <th className="th text-right">Diagnostic rate</th>
                <th className="th">Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {patterns.slice(0, patternLimit).map((p) => (
                <tr key={p.sig} className="row-hover align-top">
                  <td className="td max-w-[320px] whitespace-normal">
                    <div className="font-medium">{p.sig}</div>
                    <div className="subtle num truncate">{p.example}</div>
                  </td>
                  <td className="num td text-right">{p.incidents.toLocaleString("en-US")}</td>
                  <td className="num td text-right">{p.ags}</td>
                  <td className="td max-w-[220px] truncate text-xs text-ink-600">{p.top_ag}</td>
                  <td className="num td text-right">{p.diagnostic_rate.toFixed(1)}%</td>
                  <td className="num td text-xs text-ink-500">{p.first_seen} → {p.last_seen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {patternLimit < patterns.length ? (
          <button type="button" className="btn mt-3" onClick={() => setPatternLimit(patterns.length)}>
            Show all {patterns.length} signatures
          </button>
        ) : (
          <p className="subtle mt-2">All {patterns.length} signatures are shown, with no truncation.</p>
        )}
      </section>

      <p className="subtle">
        Corpus cut-off {qm.as_of} · model cut-off {meta.as_of} · application universe{" "}
        <span className="num">{UNIVERSE}</span> · platforms <span className="num">{platforms.length}</span>.
      </p>
    </div>
  );
}
