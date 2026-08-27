"use client";
import { useMemo, useState } from "react";
import {
  aiApps, aiPlatforms, aiTechStack, applications, computeGaps, subsetCoverage,
  qualityOfAgs, meta, quality, UNIVERSE, isTbd,
} from "@/lib/data";
import type { Criticality } from "@/types";
import { Metric, InlineMetric } from "@/components/Metric";
import { Note, SectionHeader, TableCaption } from "@/components/SectionHeader";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { AiTag, ApproxTag, AppLink, CriticalityChip, NotRoutableTag, TbdValue } from "@/components/Chips";
import { CoverageCompareChart } from "@/components/QualityCharts";

const CRITS: Criticality[] = ["C1", "C2", "C3", "C-"];

export function AiOps() {
  const [onlyUnrouted, setOnlyUnrouted] = useState(true);

  const aiCov = subsetCoverage(aiApps);
  const allCov = subsetCoverage(applications);
  const aiGaps = computeGaps(aiApps);
  const allGaps = computeGaps(applications);

  const chartRows = aiCov.map((r, i) => ({
    link: r.id,
    subsetPct: r.coverage_pct,
    portfolioPct: allCov[i].coverage_pct,
    subsetLabel: `${r.resolved} de ${r.universe} AI/ML`,
    portfolioLabel: `${allCov[i].resolved} de ${allCov[i].universe} del portafolio`,
  }));

  const unrouted = useMemo(
    () => aiApps.filter((a) => a.ags.length === 0).sort((a, b) => a.name.localeCompare(b.name, "en")),
    [],
  );
  const shown = onlyUnrouted ? unrouted : [...aiApps].sort((a, b) => a.name.localeCompare(b.name, "en"));

  const aiAgNames = useMemo(() => {
    const s = new Set<string>();
    for (const a of aiApps) for (const g of a.ags) s.add(g);
    return [...s];
  }, []);
  const q = qualityOfAgs(aiAgNames);

  const critMix = CRITS.map((c) => ({ c, n: aiApps.filter((a) => a.criticality === c).length }));

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-pep-900">AI Ops</h1>
          <AiTag />
        </div>
        <p className="mt-1 max-w-3xl text-sm text-ink-700">
          The AI/ML segment of the portfolio, measured with the same four links as everything else. The gap
          against the full portfolio is the message of this screen, not a flaw to be smoothed over.
        </p>
      </header>

      {/* ---------- las cuatro cifras de cabecera, cada una con su denominador ---------- */}
      <section className="card card-pad">
        <SectionHeader kicker={`Cluster 06 · ${aiApps.length} AI/ML applications`} title="Segment coverage" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="AI/ML applications" resolved={aiApps.length} universe={UNIVERSE} unitLabel="of the portfolio" />
          <Metric label="With an Assignment Group" resolved={aiGaps.routable} universe={aiApps.length} unitLabel="routable" tone="gap" />
          <Metric label="With a declared DPM" resolved={aiGaps.owned} universe={aiApps.length} unitLabel="owned" />
          <Metric label="With an identified platform" resolved={aiGaps.platformKnown} universe={aiApps.length} unitLabel="located" tone="gap" />
        </div>
        <Note tone="warn" >
          <span className="mt-3 block">
            {meta.ai_ops.note} With the figures in view: routing coverage for the segment stands at{" "}
            <InlineMetric resolved={aiGaps.routable} universe={aiApps.length} /> against{" "}
            <InlineMetric resolved={allGaps.routable} universe={allGaps.universe} /> for the full portfolio, a
            difference of{" "}
            <span className="num font-semibold">
              {((aiGaps.routable / aiApps.length - allGaps.routable / allGaps.universe) * 100).toFixed(1)} pp
            </span>
            . Both figures carry their own denominator because the universes differ and are not comparable as
            counts.
          </span>
        </Note>
      </section>

      {/* ---------- comparativo por eslabon ---------- */}
      <section className="card card-pad">
        <SectionHeader kicker="The four links" title="AI/ML against the full portfolio" />
        <p className="subtle mb-3">
          Each bar is a proportion over its own universe: {aiApps.length} AI/ML applications against{" "}
          {UNIVERSE} in the portfolio. They are never added to nor subtracted from one another.
        </p>
        <CoverageCompareChart rows={chartRows} />
        <div className="mt-3 scroll-thin overflow-x-auto">
          <table className="w-full border-collapse">
            <TableCaption>
              Two different universes per row: {aiApps.length} AI/ML applications and {UNIVERSE} in the
              portfolio. The difference is in percentage points between the two proportions, not a count.
            </TableCaption>
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Link</th>
                <th className="th">AI/ML</th>
                <th className="th">Full portfolio</th>
                <th className="th text-right">Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {aiCov.map((r, i) => {
                const diff = r.coverage_pct - allCov[i].coverage_pct;
                return (
                  <tr key={r.id} className="row-hover">
                    <td className="td font-medium">{r.id} · {r.link}</td>
                    <td className="td"><InlineMetric resolved={r.resolved} universe={r.universe} /></td>
                    <td className="td"><InlineMetric resolved={allCov[i].resolved} universe={allCov[i].universe} /></td>
                    <td className="num td text-right">{diff > 0 ? "+" : ""}{diff.toFixed(1)} pp</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="subtle mt-2">
          The difference is expressed in percentage points between two proportions with different universes. It
          is not a count and cannot be added to anything.
        </p>
      </section>

      {/* ---------- pila tecnologica ---------- */}
      <section className="card card-pad">
        <SectionHeader
          kicker={`${aiPlatforms.length} platforms flagged as AI · ${aiTechStack.length} platforms with at least one AI/ML app`}
          title="Technology stack of the segment"
        >
          <EvidenceBadge tier="E2" showAuthority />
        </SectionHeader>
        <Note>
          An AI/ML application can run on platforms that are not AI platforms, and an AI platform can host
          applications that are not AI/ML. Both are listed separately instead of being merged.{" "}
          <InlineMetric resolved={aiGaps.platformKnown} universe={aiApps.length} /> of the AI/ML applications have
          an identified platform, so this stack describes only those.
        </Note>
        <div className="mt-3 scroll-thin overflow-x-auto">
          <table className="w-full border-collapse">
            <TableCaption>
              “Routable” is the share of that platform’s apps that have an Assignment Group: the denominator is
              the <span className="num">Total apps</span> column of the same row, not the portfolio.
            </TableCaption>
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Platform</th>
                <th className="th">Tier</th>
                <th className="th text-right">AI/ML apps</th>
                <th className="th text-right">Total apps</th>
                <th className="th text-right">Routable</th>
                <th className="th">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {aiTechStack.map(({ platform: p, aiCount }) => (
                <tr key={p.platform_id} className="row-hover">
                  <td className="td font-medium">{p.name}</td>
                  <td className="td text-xs text-ink-600">{p.tier}</td>
                  <td className="num td text-right">{aiCount}</td>
                  <td className="num td text-right text-ink-500">{p.blast_radius_direct}</td>
                  <td className="num td text-right">{p.routable_pct.toFixed(1)}%</td>
                  <td className="td">
                    <span className="flex gap-1">
                      {p.is_ai_platform ? <AiTag /> : null}
                      {p.is_legacy ? <span className="rounded border border-ink-300 bg-ink-50 px-1 py-0.5 text-[10px] text-ink-500">legacy</span> : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- criticidad ---------- */}
      <section className="card card-pad">
        <SectionHeader kicker="Declared criticality" title="How critical the segment is — and how much is unknown" />
        <div className="grid gap-4 sm:grid-cols-4">
          {critMix.map(({ c, n }) => (
            <div key={c} className="rounded border border-ink-200 p-3">
              <CriticalityChip value={c} withLabel />
              <div className="num mt-1.5 text-xl font-semibold text-pep-900">{n}</div>
              <div className="subtle num">of {aiApps.length} · {((n / aiApps.length) * 100).toFixed(1)}%</div>
            </div>
          ))}
        </div>
        <Note tone="warn">
          <span className="mt-3 block">
            <InlineMetric resolved={aiGaps.withoutCriticality} universe={aiApps.length} /> of the AI/ML
            applications have no declared criticality. None is imputed: an application without criticality weighs
            zero in any weighted aggregate, and that does not mean it does not matter — it means it has not been
            classified.
          </span>
        </Note>
      </section>

      {/* ---------- calidad aproximada del segmento ---------- */}
      <section className="card card-pad">
        <SectionHeader kicker="Work notes quality" title="The groups that serve the AI/ML segment">
          <ApproxTag>measured per AG, not per application</ApproxTag>
        </SectionHeader>
        <Note tone="warn">
          The segment touches <span className="num font-semibold">{aiAgNames.length}</span> distinct Assignment
          Groups, of which <InlineMetric resolved={q.measured} universe={aiAgNames.length} /> have an eligible
          corpus. These figures describe those groups, which also serve applications outside the segment; they are
          not the quality of the AI/ML applications. Across the whole model only{" "}
          <InlineMetric
            resolved={quality.meta.join_coverage.ags_matched}
            universe={quality.meta.join_coverage.ags_bridge}
          />{" "}
          of the group keys could be joined to the quality corpus.
        </Note>
        {q.measured === 0 ? (
          <p className="mt-3 text-sm text-ink-600">
            None of the groups serving the segment reaches the eligibility threshold. There is no measurement and
            it is not replaced by the portfolio average.
          </p>
        ) : (
          <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Metric compact label="AGs with a measurement" resolved={q.measured} universe={aiAgNames.length} unitLabel="AGs of the segment" />
            <div>
              <div className="label">Weighted diagnostic rate</div>
              <div className="num text-lg font-semibold text-pep-900">{q.diagnostic_rate?.toFixed(1)}%</div>
              <div className="subtle num mt-0.5">over {q.incidents.toLocaleString("en-US")} incidents</div>
            </div>
            <div>
              <div className="label">With root cause</div>
              <div className="num text-lg font-semibold text-pep-900">{q.has_root_rate?.toFixed(1)}%</div>
              <div className="subtle num mt-0.5">over {q.incidents.toLocaleString("en-US")} incidents</div>
            </div>
            <div>
              <div className="label">Poor documentation</div>
              <div className="num text-lg font-semibold text-pep-900">{q.poor_rate?.toFixed(1)}%</div>
              <div className="subtle num mt-0.5">over {q.incidents.toLocaleString("en-US")} incidents</div>
            </div>
          </div>
        )}
      </section>

      {/* ---------- la lista que no se filtra ---------- */}
      <section className="card card-pad">
        <SectionHeader
          kicker={`${shown.length} applications listed`}
          title={onlyUnrouted ? "AI/ML applications with no declared response route" : "All AI/ML applications"}
        >
          <div className="flex items-center gap-1">
            <button type="button" className={`btn ${onlyUnrouted ? "btn-active" : ""}`} onClick={() => setOnlyUnrouted(true)} aria-pressed={onlyUnrouted}>
              No AG <span className="num opacity-70">{unrouted.length}</span>
            </button>
            <button type="button" className={`btn ${!onlyUnrouted ? "btn-active" : ""}`} onClick={() => setOnlyUnrouted(false)} aria-pressed={!onlyUnrouted}>
              All <span className="num opacity-70">{aiApps.length}</span>
            </button>
          </div>
        </SectionHeader>

        <Note tone={onlyUnrouted ? "warn" : "neutral"}>
          {onlyUnrouted ? (
            <>
              <InlineMetric resolved={unrouted.length} universe={aiApps.length} /> of the AI/ML applications have
              no Assignment Group. An incident on any of them finds no destination. The list is published in full:
              the ones that additionally have no DPM and no platform are not hidden.
            </>
          ) : (
            <>
              The whole segment, including the applications with no route, no owner and no platform. No row is
              excluded for being incomplete.
            </>
          )}
        </Note>

        <div className="mt-3 scroll-thin max-h-[520px] overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Application</th>
                <th className="th">Criticality</th>
                <th className="th">Process</th>
                <th className="th">DPM</th>
                <th className="th text-right">Platforms</th>
                <th className="th text-right">Assignment Groups</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {shown.map((a) => (
                <tr key={a.app_id} className="row-hover">
                  <td className="td max-w-[300px] truncate">
                    <AppLink appId={a.app_id} name={a.name} />
                  </td>
                  <td className="td"><CriticalityChip value={a.criticality} /></td>
                  <td className="td max-w-[200px] truncate text-xs text-ink-600"><TbdValue value={a.process} /></td>
                  <td className="td max-w-[180px] truncate text-xs text-ink-600">
                    {isTbd(a.dpm) ? <TbdValue value={a.dpm} /> : a.dpm}
                  </td>
                  <td className="num td text-right">{a.platforms.length || <span className="text-ink-400">0</span>}</td>
                  <td className="td text-right">
                    {a.ags.length === 0 ? <NotRoutableTag /> : <span className="num">{a.ags.length}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="subtle">
        Cut-off {meta.as_of}. The AI/ML segment is identified by the inventory flag, not by inferring anything
        from the application name.
      </p>
    </div>
  );
}
