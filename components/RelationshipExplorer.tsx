"use client";
import { useMemo, useState } from "react";
import {
  applications, platforms, AG_OPTIONS, computeSankey, neighbourhood, getApp,
  UNIVERSE, meta, computeGaps, type FocusKind,
} from "@/lib/data";
import { Metric, InlineMetric } from "@/components/Metric";
import { Note, SectionHeader } from "@/components/SectionHeader";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { SankeyFlow } from "@/components/SankeyFlow";
import { NeighbourGraph } from "@/components/NeighbourGraph";

const GAPS = computeGaps();
const TOP_DEFAULT = 8;

export function RelationshipExplorer() {
  /* ---------------- Sankey ---------------- */
  const byRadius = useMemo(
    () => [...platforms].sort((a, b) => b.blast_radius_direct - a.blast_radius_direct),
    [],
  );
  const [topN, setTopN] = useState(TOP_DEFAULT);
  const [maxProcesses, setMaxProcesses] = useState(10);
  const flowPlatforms = useMemo(() => byRadius.slice(0, topN).map((p) => p.name), [byRadius, topN]);
  const flow = useMemo(
    () => computeSankey(flowPlatforms, { maxProcesses }),
    [flowPlatforms, maxProcesses],
  );

  /* ---------------- neighbourhood graph ---------------- */
  const [kind, setKind] = useState<FocusKind>("application");
  const [appKey, setAppKey] = useState("APP0012");
  const [platKey, setPlatKey] = useState(byRadius[0]?.name ?? "");
  const [agKey, setAgKey] = useState(AG_OPTIONS[0]?.name ?? "");
  const [q, setQ] = useState("");

  const appChoices = useMemo(() => {
    const s = q.trim().toLowerCase();
    const pool = [...applications].sort(
      (a, b) => b.platforms.length + b.ags.length - (a.platforms.length + a.ags.length),
    );
    return (s ? pool.filter((a) => a.name.toLowerCase().includes(s) || a.apm.toLowerCase().includes(s)) : pool)
      .slice(0, 300);
  }, [q]);

  const focusKey = kind === "application" ? appKey : kind === "platform" ? platKey : agKey;
  const hood = useMemo(() => neighbourhood(kind, focusKey), [kind, focusKey]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-pep-900">Relationships</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-700">
          The same model seen as a graph. Above, where platform failure flows through business process to
          a response route. Below, the direct neighbourhood of any single node, with every edge drawn —
          because every relationship here is N:M and cannot be collapsed into a lookup.
        </p>
      </header>

      {/* ============================ SANKEY ============================ */}
      <section className="card card-pad">
        <SectionHeader
          kicker="Flow · Platform → Business process → Response route"
          title="Where a platform failure lands"
        >
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-ink-700">
              Platforms
              <select className="input w-24" value={topN} onChange={(e) => setTopN(Number(e.target.value))}>
                {[5, 8, 12, 20, platforms.length].map((v) => (
                  <option key={v} value={v}>{v === platforms.length ? `all ${v}` : `top ${v}`}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-ink-700">
              Processes
              <select className="input w-24" value={maxProcesses} onChange={(e) => setMaxProcesses(Number(e.target.value))}>
                {[6, 10, 14, 20].map((v) => <option key={v} value={v}>top {v}</option>)}
              </select>
            </label>
          </div>
        </SectionHeader>

        {/* R4 · un Sankey suma por construccion; se declara la unidad. */}
        <Note tone="warn">
          <strong>The unit of this diagram is the platform–application link, not the application.</strong>{" "}
          A Sankey adds by construction, and blast radius is not additive: an application that runs on two
          platforms contributes two links. The diagram draws{" "}
          <span className="num font-semibold">{flow.linkTotal}</span> links behind{" "}
          <span className="num font-semibold">{flow.appTotal}</span> distinct applications, so it overcounts
          by <span className="num font-semibold">{flow.overcount}</span>. For the deduplicated total, use{" "}
          <a href="/blast-radius" className="font-medium text-pep-700 underline">Blast Radius</a>.
        </Note>

        <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="label">Links drawn</div>
            <div className="num text-2xl font-semibold text-pep-900">{flow.linkTotal}</div>
            <div className="subtle mt-0.5">platform–application pairs</div>
          </div>
          <Metric label="Distinct applications behind them" resolved={flow.appTotal} universe={UNIVERSE}
                  unitLabel="of the portfolio" />
          <div>
            <div className="label">Overcount of the flow</div>
            <div className="num text-2xl font-semibold text-pep-900">{flow.overcount}</div>
            <div className="subtle mt-0.5">apps counted more than once</div>
          </div>
          <Metric label="Applications that cannot enter" resolved={flow.appsWithoutPlatform}
                  universe={UNIVERSE} unitLabel="no platform identified" tone="gap" />
        </div>

        <div className="mt-4">
          <SankeyFlow nodes={flow.nodes} links={flow.links} height={Math.max(460, flow.nodes.length * 22)} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-ink-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#02355A" }} /> Platform
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#155798" }} /> Business process
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#93AFC9" }} /> Response route
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#8496A8" }} /> Route with a declared gap
          </span>
        </div>

        <div className="mt-3 space-y-2">
          <Note>
            The last column is a 2×2 of routing and ownership, so the flow is conserved end to end: every
            application has exactly one process and falls into exactly one route bucket. A bucket that reads
            <span className="num"> No AG</span> or <span className="num">DPM TBD</span> is drawn in grey — it
            is a declared gap, not a risk level, and it is never coloured as one.
          </Note>
          {flow.excludedPlatforms.length > 0 ? (
            <Note tone="warn">
              <strong>{flow.excludedPlatforms.length} platforms are not drawn</strong> at this setting, holding{" "}
              <span className="num font-semibold">
                {flow.excludedPlatforms.reduce((s, p) => s + p.apps, 0)}
              </span>{" "}
              direct application links between them. They are excluded by the selector above, not because they
              do not matter:{" "}
              <span className="text-ink-500">
                {flow.excludedPlatforms.slice(0, 8).map((p) => `${p.name} (${p.apps})`).join(" · ")}
                {flow.excludedPlatforms.length > 8 ? " …" : ""}
              </span>
            </Note>
          ) : null}
        </div>
      </section>

      {/* ======================== NEIGHBOURHOOD ======================== */}
      <section className="card card-pad">
        <SectionHeader kicker="Graph · direct neighbourhood" title="Who touches what">
          <div className="flex flex-wrap items-center gap-1">
            {([["application", "Application"], ["platform", "Platform"], ["assignment_group", "Assignment Group"]] as [FocusKind, string][])
              .map(([k, label]) => (
                <button key={k} type="button" onClick={() => setKind(k)}
                        className={`btn ${kind === k ? "btn-active" : ""}`} aria-pressed={kind === k}>
                  {label}
                </button>
              ))}
          </div>
        </SectionHeader>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kind === "application" ? (
            <>
              <label className="block">
                <span className="label">Filter by name or APM</span>
                <input className="input mt-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" />
              </label>
              <label className="block lg:col-span-2">
                <span className="label">Focus application</span>
                <select className="input mt-1" value={appKey} onChange={(e) => setAppKey(e.target.value)}>
                  {appChoices.map((a) => (
                    <option key={a.app_id} value={a.app_id}>
                      {a.name} — {a.platforms.length} plat · {a.ags.length} AG
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : kind === "platform" ? (
            <label className="block lg:col-span-3">
              <span className="label">Focus platform</span>
              <select className="input mt-1" value={platKey} onChange={(e) => setPlatKey(e.target.value)}>
                {byRadius.map((p) => (
                  <option key={p.platform_id} value={p.name}>{p.name} — {p.blast_radius_direct} apps</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block lg:col-span-3">
              <span className="label">Focus Assignment Group</span>
              <select className="input mt-1" value={agKey} onChange={(e) => setAgKey(e.target.value)}>
                {AG_OPTIONS.map((g) => (
                  <option key={g.ag_id} value={g.name}>{g.name} — {g.app_count} apps</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {!hood ? (
          <p className="mt-3 text-sm text-ink-600">That node is not in the current cut of the graph.</p>
        ) : (
          <>
            <div className="mt-3 space-y-2">
              <Note>{hood.note}</Note>
              {hood.truncated.map((t) => (
                <Note key={t.kind} tone="warn">
                  <strong>
                    Showing {t.shown} of {t.total}{" "}
                    {t.kind === "application" ? "applications"
                      : t.kind === "platform" ? "platforms" : "assignment groups"}.
                  </strong>{" "}
                  {t.total - t.shown} are not drawn because the picture stops being readable. The cut is
                  stated here instead of the chart silently pretending the neighbourhood is smaller than it is.
                </Note>
              ))}
              {kind === "application" && getApp(appKey) ? (
                <p className="subtle">
                  Focus: <span className="font-medium text-ink-700">{getApp(appKey)!.name}</span> ·{" "}
                  <span className="num">{getApp(appKey)!.apm || "no APM"}</span> · degree{" "}
                  <span className="num">{hood.focus.degree}</span> in the full model.
                </p>
              ) : null}
            </div>

            <div className="mt-3">
              <NeighbourGraph data={hood} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-ink-600">
              <span className="flex items-center gap-1.5">
                <svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="#155798" strokeWidth="1.5" /></svg>
                Edge from an E2 source <EvidenceBadge tier="E2" />
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="#A03535" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
                Edge derived from free text <EvidenceBadge tier="E3" />
              </span>
              <span>Hover a node to isolate its edges.</span>
            </div>
          </>
        )}
      </section>

      <p className="subtle">
        Data cut-off {meta.as_of}. The graph contains no Dashboard → Application edges and no audience
        edges: that link is out of v1 by a scope decision.{" "}
        <InlineMetric resolved={GAPS.platformKnown} universe={GAPS.universe} /> applications have a platform
        edge and <InlineMetric resolved={GAPS.routable} universe={GAPS.universe} /> have at least one
        Assignment Group edge; the rest are isolated nodes and stay in the model as such.
      </p>
    </div>
  );
}
