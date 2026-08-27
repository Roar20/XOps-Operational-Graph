"use client";
import { useEffect, useMemo, useState } from "react";
import { computeBlast, platforms, quality, TOTAL_AGS, TOTAL_DPMS, UNIVERSE } from "@/lib/data";
import type { Criticality } from "@/types";
import { AiTag, AppLink, ApproxTag, CriticalityChip, NotRoutableTag, TbdValue } from "./Chips";
import { InlineMetric, Metric } from "./Metric";
import { Note, SectionHeader, TableCaption } from "./SectionHeader";
import { EvidenceBadge } from "./EvidenceBadge";

const ORDER: Criticality[] = ["C1", "C2", "C3", "C-"];
const BAR: Record<Criticality, string> = {
  C1: "bg-bad", C2: "bg-ev-e2", C3: "bg-pep-500", "C-": "bg-ink-300",
};
const WEIGHT: Record<Criticality, number> = { C1: 5, C2: 3, C3: 1, "C-": 0 };

export function BlastRadius() {
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState("");

  /* Preselection via ?p=NAME, which is how an application record links in here.
     Read from location on mount so a statically prerendered route does not need a
     Suspense boundary. Names that do not exist are dropped. */
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).getAll("p");
    if (!wanted.length) return;
    const valid = wanted.filter((n) => platforms.some((p) => p.name === n));
    if (valid.length) setSelected(valid);
  }, []);

  const toggle = (n: string) =>
    setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  const b = useMemo(() => computeBlast(selected), [selected]);

  const listed = useMemo(() => {
    const s = q.trim().toLowerCase();
    const arr = [...platforms].sort((x, y) => y.blast_radius_direct - x.blast_radius_direct);
    return s ? arr.filter((p) => p.name.toLowerCase().includes(s)) : arr;
  }, [q]);

  const agsMeasured = quality.meta.join_coverage;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-pep-900">Blast Radius</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-700">
          Translation from technical failure to business function. Select one or more platforms to see
          which applications fall, which processes stop and who has to answer.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="card flex max-h-[78vh] flex-col overflow-hidden lg:sticky lg:top-32">
          <div className="border-b border-ink-200 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-pep-900">Platforms</h2>
              <span className="subtle num">{selected.length} of {platforms.length}</span>
            </div>
            <input className="input mt-2" placeholder="Filter platform…" value={q}
              onChange={(e) => setQ(e.target.value)} />
            {selected.length > 0 ? (
              <button type="button" className="btn mt-2 w-full justify-center" onClick={() => setSelected([])}>
                Clear selection
              </button>
            ) : null}
          </div>
          <ul className="scroll-thin flex-1 divide-y divide-ink-100 overflow-y-auto">
            {listed.map((p) => {
              const on = selected.includes(p.name);
              return (
                <li key={p.platform_id}>
                  <label className={`flex cursor-pointer items-start gap-2 px-3 py-2 ${on ? "bg-pep-100" : "hover:bg-pep-50"}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(p.name)}
                      className="mt-0.5 rounded border-ink-300 text-pep-700 focus:ring-pep-500" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-ink-900">{p.name}</span>
                        {p.is_ai_platform ? <AiTag /> : null}
                      </span>
                      <span className="subtle num block">
                        {p.blast_radius_direct} apps · tier {p.tier}{p.is_legacy ? " · legacy" : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="space-y-5">
          {selected.length === 0 ? (
            <div className="card card-pad">
              <p className="text-sm text-ink-700">
                Select at least one platform. When several are combined the total shown is always the{" "}
                <strong>deduplicated union</strong> of applications, never the sum of their direct radii.
              </p>
              <p className="subtle mt-2">
                Blast radius is not additive: some applications run on more than one platform, and
                adding the radii counts them twice.
              </p>
            </div>
          ) : (
            <>
              <section className="card card-pad">
                <SectionHeader kicker="Blast radius is not additive" title="Applications affected" />
                <div className="grid gap-5 sm:grid-cols-3">
                  <Metric label="Deduplicated union" resolved={b.unionCount} universe={UNIVERSE}
                    unitLabel="of the portfolio" />
                  <div>
                    <div className="label">Sum of direct radii</div>
                    <div className="num text-2xl font-semibold leading-tight text-ink-400 line-through">
                      {b.naiveSum}
                    </div>
                    <div className="subtle mt-0.5">Not a valid total</div>
                  </div>
                  <div>
                    <div className="label">Overlap</div>
                    <div className="num text-2xl font-semibold leading-tight text-pep-900">{b.overcount}</div>
                    <div className="subtle mt-0.5">
                      {b.shared.length} application{b.shared.length === 1 ? "" : "s"} on more than one platform
                    </div>
                  </div>
                </div>

                {selected.length > 1 ? (
                  <div className="mt-3">
                    <Note>
                      {b.shared.length > 0 ? (
                        <>
                          <strong>{b.shared.length}</strong> of the {b.unionCount} affected applications
                          run on more than one of the selected platforms, so the sum{" "}
                          <span className="num line-through">{b.naiveSum}</span> overcounts by{" "}
                          <span className="num font-semibold">{b.overcount}</span>. The valid total is{" "}
                          <span className="num font-semibold">{b.unionCount}</span>.
                        </>
                      ) : (
                        <>
                          The selected platforms share no applications, so union and sum agree at{" "}
                          <span className="num font-semibold">{b.unionCount}</span>. The figure shown is
                          still the union.
                        </>
                      )}
                    </Note>
                  </div>
                ) : null}

                {b.shared.length > 0 ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-pep-700 hover:text-pep-900">
                      Show the {b.shared.length} overlapping applications
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {b.shared.map(({ app, platforms: ps }) => (
                        <li key={app.app_id} className="flex flex-wrap items-center gap-1.5 text-xs text-ink-600">
                          <AppLink appId={app.app_id} name={app.name} />
                          <span className="text-ink-400">on</span>
                          {ps.map((n) => (
                            <span key={n} className="num rounded border border-ink-300 bg-pep-50 px-1 py-0.5 text-[10px]">
                              {n}
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </section>

              {/* The centrepiece of this screen. */}
              <section className="card card-pad border-pep-500/40">
                <SectionHeader kicker="Centrepiece · technical failure → business function"
                  title="Business processes affected" />
                <ul className="space-y-1.5">
                  {b.processes.map((p) => (
                    <li key={p.key} className="flex items-center gap-3">
                      <span className="w-52 shrink-0 truncate text-sm font-medium text-ink-900">
                        <TbdValue value={p.key} />
                      </span>
                      <span className="h-5 flex-1 overflow-hidden rounded bg-ink-100">
                        <span className="block h-full rounded bg-pep-900"
                          style={{ width: `${(p.count / b.processes[0].count) * 100}%` }} />
                      </span>
                      <span className="num w-24 shrink-0 text-right text-xs text-ink-600">
                        {p.count} of {b.unionCount}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="subtle mt-2">
                  Process and sector come from link L4 <EvidenceBadge tier="E2" />. Applications with no
                  declared process show up as TBD; they are not discarded.
                </p>
              </section>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className="card card-pad">
                  <SectionHeader title="Sectors reached" />
                  <ul className="space-y-1.5">
                    {b.sectors.slice(0, 12).map((s) => (
                      <li key={s.key} className="flex items-center gap-3">
                        <span className="w-40 shrink-0 truncate text-sm text-ink-800" title={s.key}>
                          <TbdValue value={s.key} />
                        </span>
                        <span className="h-3 flex-1 overflow-hidden rounded bg-ink-100">
                          <span className="block h-full rounded bg-pep-700"
                            style={{ width: `${(s.count / b.sectors[0].count) * 100}%` }} />
                        </span>
                        <span className="num w-20 shrink-0 text-right text-xs text-ink-600">
                          {s.count} of {b.unionCount}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {b.sectors.length > 12 ? (
                    <p className="subtle mt-2">
                      Showing 12 of {b.sectors.length} declared sector combinations.
                    </p>
                  ) : null}
                </section>

                <section className="card card-pad">
                  <SectionHeader title="Criticality mix">
                    <span className="subtle">Counting ≠ weighting</span>
                  </SectionHeader>
                  <div className="flex h-5 w-full overflow-hidden rounded">
                    {ORDER.map((c) => b.criticalityMix[c] > 0 ? (
                      <span key={c} className={BAR[c]} title={`${c}: ${b.criticalityMix[c]} of ${b.unionCount}`}
                        style={{ width: `${(b.criticalityMix[c] / b.unionCount) * 100}%` }} />
                    ) : null)}
                  </div>
                  <table className="mt-3 w-full">
                    <tbody className="divide-y divide-ink-100">
                      {ORDER.map((c) => (
                        <tr key={c}>
                          <td className="py-1.5"><CriticalityChip value={c} withLabel /></td>
                          <td className="num py-1.5 text-right text-sm text-ink-800">
                            {b.criticalityMix[c]} of {b.unionCount}
                          </td>
                          <td className="num py-1.5 text-right text-xs text-ink-500">
                            weight {WEIGHT[c]} · {b.criticalityMix[c] * WEIGHT[c]} pts
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-ink-200 pt-3">
                    <div>
                      <div className="label">Plain count</div>
                      <div className="num text-xl font-semibold text-pep-900">{b.unionCount}</div>
                      <div className="subtle">applications</div>
                    </div>
                    <div>
                      <div className="label">Weighted blast radius</div>
                      <div className="num text-xl font-semibold text-pep-900">{b.weighted}</div>
                      <div className="subtle">Σ criticality_weight</div>
                    </div>
                  </div>
                  <p className="subtle mt-2">
                    The weighted figure uses criticality only, and{" "}
                    <span className="num">{b.criticalityMix["C-"]}</span> of the {b.unionCount} affected
                    applications have none declared, so they weigh zero — which does not mean they do not
                    matter.
                  </p>
                </section>
              </div>

              <section className="card card-pad">
                <SectionHeader kicker="Who has to answer" title="Response route" />
                <div className="grid gap-5 sm:grid-cols-3">
                  <Metric label="Applications with a route" resolved={b.routable.length} universe={b.unionCount}
                    unitLabel="routable" tone="good" />
                  <Metric label="Assignment Groups to involve" resolved={b.ags.length} universe={TOTAL_AGS}
                    unitLabel="groups in the catalogue" />
                  <Metric label="DPMs to notify" resolved={b.dpms.length} universe={TOTAL_DPMS}
                    unitLabel="confirmed DPMs in the portfolio"
                    note={<>{b.apps.filter((a) => !a.gates.owned).length} of {b.unionCount} affected applications have their DPM in TBD</>} />
                </div>

                <div className="mt-4 grid gap-5 lg:grid-cols-2">
                  <div>
                    <h3 className="label mb-1.5">Assignment Groups</h3>
                    {b.ags.length === 0 ? (
                      <p className="text-sm text-ink-500">No affected application has a declared AG.</p>
                    ) : (
                      <ul className="scroll-thin max-h-64 space-y-1 overflow-y-auto pr-1">
                        {b.ags.map((g) => (
                          <li key={g.ag_id} className="flex items-center justify-between gap-2 rounded border border-ink-200 px-2 py-1.5 text-sm">
                            <span className="truncate text-ink-800" title={g.name}>{g.name}</span>
                            <span className="num shrink-0 text-xs text-ink-500">{g.app_count} apps</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="label mb-1.5">DPMs to notify</h3>
                    {b.dpms.length === 0 ? (
                      <p className="text-sm text-ink-500">No confirmed DPM among the affected applications.</p>
                    ) : (
                      <ul className="scroll-thin max-h-64 space-y-1 overflow-y-auto pr-1">
                        {b.dpms.map((d) => (
                          <li key={d.name} className="flex items-center justify-between gap-2 rounded border border-ink-200 px-2 py-1.5 text-sm">
                            <span className="truncate text-ink-800">{d.name}</span>
                            <span className="num shrink-0 text-xs text-ink-500">{d.appCount} apps</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {b.unroutable.length > 0 ? (
                  <div className="mt-4 rounded border border-ev-e2/50 bg-ev-e2/[0.07] p-3">
                    <h3 className="text-sm font-semibold text-ink-900">No declared response route</h3>
                    <p className="mt-0.5 text-xs text-ink-700">
                      <InlineMetric resolved={b.unroutable.length} universe={b.unionCount} /> of the
                      affected applications have no Assignment Group. An incident on this platform finds
                      no destination for them.
                    </p>
                    <ul className="scroll-thin mt-2 max-h-52 space-y-1 overflow-y-auto pr-1">
                      {b.unroutable.map((a) => (
                        <li key={a.app_id} className="flex flex-wrap items-center gap-2 text-xs">
                          <AppLink appId={a.app_id} name={a.name} />
                          <CriticalityChip value={a.criticality} />
                          <NotRoutableTag />
                          <span className="text-ink-500">DPM: <TbdValue value={a.dpm} /></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              {/* Documentation quality of the AGs reached. */}
              <section className="card card-pad">
                <SectionHeader kicker="Documentation of the groups reached" title="Work notes quality">
                  <ApproxTag>measured per AG, not per application</ApproxTag>
                </SectionHeader>
                <div className="grid gap-5 sm:grid-cols-3">
                  <Metric label="AGs with measured quality" resolved={b.qualityRows.length} universe={b.ags.length}
                    unitLabel="of the groups reached" />
                  <div>
                    <div className="label">Incidents covered</div>
                    <div className="num text-2xl font-semibold text-pep-900">
                      {b.qualityIncidents.toLocaleString("en-US")}
                    </div>
                    <div className="subtle mt-0.5">of the eligible corpus</div>
                  </div>
                  <Metric label="Join coverage across the model" resolved={agsMeasured.ags_matched}
                    universe={agsMeasured.ags_bridge} unitLabel="bridge AG keys with measured quality" />
                </div>
                {b.qualityRows.length === 0 ? (
                  <div className="mt-3">
                    <Note tone="warn">
                      None of the {b.ags.length} groups reached has measured quality, so nothing can be
                      asserted about documentation for this selection. The gap is declared instead of
                      being filled in.
                    </Note>
                  </div>
                ) : (
                  <>
                    <div className="scroll-thin mt-3 max-h-72 overflow-auto">
                      <table className="w-full border-collapse">
                        <TableCaption>
                          Every rate is computed over the <span className="num">Incidents</span> column of
                          its own row: the denominators differ per group and are never averaged together.
                          The score comes from {quality.meta.instrument}, in points out of 100.
                        </TableCaption>
                        <thead className="sticky top-0 border-b border-ink-200 bg-pep-50">
                          <tr>
                            <th className="th">Assignment Group</th>
                            <th className="th">Incidents</th>
                            <th className="th">Diagnostic rate</th>
                            <th className="th">With root cause</th>
                            <th className="th">Score</th>
                            <th className="th">Poor rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ink-100">
                          {[...b.qualityRows].sort((x, y) => y.incidents - x.incidents).map((r) => (
                            <tr key={r.ag_key} className="row-hover">
                              <td className="td max-w-[320px] truncate font-medium" title={r.name}>{r.name}</td>
                              <td className="num td">{r.incidents.toLocaleString("en-US")}</td>
                              <td className="num td">{r.diagnostic_rate.toFixed(1)}%</td>
                              <td className="num td">{r.has_root_rate.toFixed(1)}%</td>
                              <td className="num td">{r.avg_score.toFixed(1)}</td>
                              <td className="num td">{r.poor_rate.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="subtle mt-2">
                      Eligible corpus{" "}
                      <InlineMetric resolved={quality.meta.eligible} universe={quality.meta.universe_raw} />{" "}
                      · scorer {quality.meta.instrument}. The quality of an application is an approximation
                      through its AGs and is labelled as such.
                    </p>
                  </>
                )}
              </section>

              <section className="card card-pad">
                <SectionHeader title="Applications in the radius" />
                <div className="scroll-thin max-h-[420px] overflow-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 border-b border-ink-200 bg-pep-50">
                      <tr>
                        <th className="th">Application</th><th className="th">Process</th>
                        <th className="th">Sector</th><th className="th">Criticality</th>
                        <th className="th">DPM</th><th className="th">AGs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {b.apps.map((a) => (
                        <tr key={a.app_id} className="row-hover">
                          <td className="td max-w-[280px] truncate"><AppLink appId={a.app_id} name={a.name} /></td>
                          <td className="td max-w-[150px] truncate"><TbdValue value={a.process} /></td>
                          <td className="td max-w-[150px] truncate"><TbdValue value={a.sector} /></td>
                          <td className="td"><CriticalityChip value={a.criticality} /></td>
                          <td className="td max-w-[150px] truncate"><TbdValue value={a.dpm} /></td>
                          <td className="td">
                            {a.ags.length > 0 ? <span className="num">{a.ags.length}</span> : <NotRoutableTag />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
