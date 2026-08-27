"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { computeBlast, TOTAL_AGS, TOTAL_DPMS } from "@/lib/selectors";
import { platforms, agById, appById, meta } from "@/lib/data";
import type { Criticality } from "@/lib/types";
import { AiTag, AppLink, CriticalityChip, NotRoutableTag, TbdValue } from "./Chips";
import { InlineMetric, Metric } from "./Metric";
import { ReadingNote, SectionHeader } from "./SectionHeader";
import { EvidenceBadge } from "./EvidenceBadge";

const CRIT_ORDER: Criticality[] = ["C1", "C2", "C3", "C-"];
const CRIT_BAR: Record<Criticality, string> = {
  C1: "bg-rose-500", C2: "bg-amber-500", C3: "bg-sky-500", "C-": "bg-ink-300",
};

export function BlastRadius() {
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState("");

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const b = useMemo(() => computeBlast(selected), [selected]);

  const listed = useMemo(() => {
    const s = q.trim().toLowerCase();
    const arr = [...platforms].sort((x, y) => y.blast_radius_direct - x.blast_radius_direct);
    return s ? arr.filter((p) => p.name.toLowerCase().includes(s)) : arr;
  }, [q]);

  const totalWeight = b.apps.reduce((s, a) => s + a.criticality_weight, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Blast Radius</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-600">
          Traduccion de falla tecnica a funcion de negocio. Selecciona una o mas plataformas para ver
          que aplicaciones caen, que procesos se detienen y quien debe responder.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Selector multi-plataforma */}
        <aside className="card flex max-h-[78vh] flex-col overflow-hidden lg:sticky lg:top-32">
          <div className="border-b border-ink-200 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink-900">Plataformas</h2>
              <span className="subtle num">{selected.length} de {platforms.length}</span>
            </div>
            <input className="input mt-2" placeholder="Filtrar plataforma…" value={q} onChange={(e) => setQ(e.target.value)} />
            {selected.length > 0 ? (
              <button type="button" className="btn mt-2 w-full justify-center" onClick={() => setSelected([])}>
                Limpiar seleccion
              </button>
            ) : null}
          </div>
          <ul className="scroll-thin flex-1 divide-y divide-ink-100 overflow-y-auto">
            {listed.map((p) => {
              const on = selected.includes(p.platform_id);
              return (
                <li key={p.platform_id}>
                  <label className={`flex cursor-pointer items-start gap-2 px-3 py-2 ${on ? "bg-ink-100" : "hover:bg-ink-50"}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(p.platform_id)} className="mt-0.5 rounded border-ink-300" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-ink-900">{p.name}</span>
                        {p.is_ai_platform ? <AiTag /> : null}
                      </span>
                      <span className="subtle num block">
                        {p.blast_radius_direct} apps directas · tier {p.tier}
                        {p.is_legacy ? " · legacy" : ""}
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
              <p className="text-sm text-ink-600">
                Selecciona al menos una plataforma. Al combinar varias, el total mostrado es siempre la{" "}
                <strong>union deduplicada</strong> de aplicaciones, nunca la suma de sus radios directos (R1).
              </p>
              <p className="subtle mt-2">
                Caso testigo: Teradata (28) y SAP BW (23) comparten 8 aplicaciones. Sumar da 51; la union real es 43.
              </p>
            </div>
          ) : (
            <>
              {/* R1 — union deduplicada, con la suma ingenua mostrada solo para contraste. */}
              <section className="card card-pad">
                <SectionHeader kicker="Regla R1 · el blast radius no es aditivo" title="Aplicaciones afectadas" />
                <div className="grid gap-5 sm:grid-cols-3">
                  <Metric
                    label="Union deduplicada"
                    resolved={b.unionCount}
                    universe={meta.universe_apps}
                    unitLabel="del portafolio"
                  />
                  <div>
                    <div className="label">Suma ingenua de radios directos</div>
                    <div className="text-2xl font-semibold leading-tight text-ink-400 line-through">
                      <span className="num">{b.naiveSum}</span>
                    </div>
                    <div className="subtle mt-0.5">No es un total valido</div>
                  </div>
                  <div>
                    <div className="label">Traslape</div>
                    <div className="text-2xl font-semibold leading-tight text-ink-900">
                      <span className="num">{b.overlapCount}</span>
                    </div>
                    <div className="subtle mt-0.5">
                      {b.sharedApps.length} aplicacion{b.sharedApps.length === 1 ? "" : "es"} en mas de una plataforma
                    </div>
                  </div>
                </div>

                {selected.length > 1 ? (
                  <div className="mt-3">
                    <ReadingNote>
                      {b.sharedApps.length > 0 ? (
                        <>
                          <strong>{b.sharedApps.length}</strong> de las {b.unionCount} aplicaciones afectadas corren
                          sobre mas de una de las plataformas seleccionadas, por lo tanto la suma{" "}
                          <span className="num line-through">{b.naiveSum}</span> sobrecuenta en{" "}
                          <span className="num font-semibold">{b.overlapCount}</span>. El total valido es{" "}
                          <span className="num font-semibold">{b.unionCount}</span>.
                        </>
                      ) : (
                        <>
                          Las plataformas seleccionadas no comparten aplicaciones, por lo tanto union y suma coinciden en{" "}
                          <span className="num font-semibold">{b.unionCount}</span>. El total mostrado sigue siendo la union.
                        </>
                      )}
                    </ReadingNote>
                  </div>
                ) : null}

                {b.sharedApps.length > 0 ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-ink-600 hover:text-ink-900">
                      Ver las {b.sharedApps.length} aplicaciones traslapadas
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {b.sharedApps.map(({ app, platformIds }) => (
                        <li key={app.app_id} className="flex flex-wrap items-center gap-1.5 text-xs text-ink-600">
                          <AppLink appId={app.app_id} name={app.name} />
                          <span className="text-ink-400">en</span>
                          {platformIds.map((pid) => (
                            <span key={pid} className="rounded border border-ink-300 bg-ink-50 px-1 py-0.5 text-[10px]">
                              {platforms.find((p) => p.platform_id === pid)?.name}
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </section>

              {/* Elemento central: traduccion a funcion de negocio. */}
              <section className="card card-pad">
                <SectionHeader kicker="Elemento central" title="Procesos afectados">
                  <span className="subtle">Falla tecnica → funcion de negocio</span>
                </SectionHeader>
                <ul className="space-y-1.5">
                  {b.processes.map((p) => (
                    <li key={p.key} className="flex items-center gap-3">
                      <span className="w-56 shrink-0 truncate text-sm text-ink-800">
                        <TbdValue value={p.key} />
                      </span>
                      <span className="h-4 flex-1 overflow-hidden rounded bg-ink-100">
                        <span
                          className="block h-full rounded bg-ink-700"
                          style={{ width: `${(p.count / b.processes[0].count) * 100}%` }}
                        />
                      </span>
                      <span className="num w-28 shrink-0 text-right text-xs text-ink-600">
                        {p.count} de {b.unionCount}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="subtle mt-2">
                  Cobertura de proceso es un eslabon <EvidenceBadge tier="E3" /> — baja autoridad. Las
                  aplicaciones sin proceso declarado aparecen como TBD, no se descartan.
                </p>
              </section>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className="card card-pad">
                  <SectionHeader title="Sectores alcanzados" />
                  <ul className="space-y-1.5">
                    {b.sectors.map((s) => (
                      <li key={s.key} className="flex items-center gap-3">
                        <span className="w-32 shrink-0 truncate text-sm text-ink-800"><TbdValue value={s.key} /></span>
                        <span className="h-3 flex-1 overflow-hidden rounded bg-ink-100">
                          <span className="block h-full rounded bg-ink-600" style={{ width: `${(s.count / b.sectors[0].count) * 100}%` }} />
                        </span>
                        <span className="num w-20 shrink-0 text-right text-xs text-ink-600">{s.count} de {b.unionCount}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="card card-pad">
                  <SectionHeader title="Mezcla de criticidad" >
                    <span className="subtle">Contar ≠ ponderar</span>
                  </SectionHeader>
                  <div className="flex h-5 w-full overflow-hidden rounded">
                    {CRIT_ORDER.map((c) =>
                      b.criticalityMix[c] > 0 ? (
                        <span
                          key={c}
                          className={CRIT_BAR[c]}
                          style={{ width: `${(b.criticalityMix[c] / b.unionCount) * 100}%` }}
                          title={`${c}: ${b.criticalityMix[c]} de ${b.unionCount}`}
                        />
                      ) : null
                    )}
                  </div>
                  <table className="mt-3 w-full">
                    <tbody className="divide-y divide-ink-100">
                      {CRIT_ORDER.map((c) => (
                        <tr key={c}>
                          <td className="py-1.5"><CriticalityChip value={c} withLabel /></td>
                          <td className="num py-1.5 text-right text-sm text-ink-800">
                            {b.criticalityMix[c]} de {b.unionCount}
                          </td>
                          <td className="num py-1.5 text-right text-xs text-ink-500">
                            peso {c === "C1" ? 5 : c === "C2" ? 3 : c === "C3" ? 1 : 0} ·{" "}
                            {b.criticalityMix[c] * (c === "C1" ? 5 : c === "C2" ? 3 : c === "C3" ? 1 : 0)} pts
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-ink-200 pt-3">
                    <div>
                      <div className="label">Conteo simple</div>
                      <div className="num text-xl font-semibold text-ink-900">{b.unionCount}</div>
                      <div className="subtle">aplicaciones</div>
                    </div>
                    <div>
                      <div className="label">Blast radius ponderado</div>
                      <div className="num text-xl font-semibold text-ink-900">{totalWeight}</div>
                      <div className="subtle">Σ criticality_weight</div>
                    </div>
                  </div>
                  <p className="subtle mt-2">
                    El ponderado usa solo criticidad. Cuando se capture el eslabon Aplicacion → Audiencia
                    incorporara ademas usuarios y vistas; hoy ese factor no existe y no se estima.
                  </p>
                </section>
              </div>

              {/* Ruta de respuesta */}
              <section className="card card-pad">
                <SectionHeader kicker="Quien debe responder" title="Ruta de respuesta" />
                <div className="grid gap-5 sm:grid-cols-3">
                  <Metric label="Aplicaciones con ruta" resolved={b.routableApps.length} universe={b.unionCount} unitLabel="ruteables" tone="good" />
                  {/* R2 — tambien estas cuentas llevan su universo. */}
                  <Metric
                    label="Assignment Groups a involucrar"
                    resolved={b.agIds.length}
                    universe={TOTAL_AGS}
                    unitLabel="grupos del catalogo"
                  />
                  <Metric
                    label="DPMs a notificar"
                    resolved={b.dpms.length}
                    universe={TOTAL_DPMS}
                    unitLabel="DPMs confirmados del portafolio"
                    note={
                      <>
                        {b.apps.filter((a) => a.dpm === "TBD").length} de {b.unionCount} aplicaciones
                        afectadas tienen DPM en TBD
                      </>
                    }
                  />
                </div>

                <div className="mt-4 grid gap-5 lg:grid-cols-2">
                  <div>
                    <h3 className="label mb-1.5">Assignment Groups</h3>
                    {b.agIds.length === 0 ? (
                      <p className="text-sm text-ink-500">Ninguna aplicacion afectada tiene AG declarado.</p>
                    ) : (
                      <ul className="scroll-thin max-h-64 space-y-1 overflow-y-auto pr-1">
                        {b.agIds.map((id) => {
                          const ag = agById.get(id);
                          if (!ag) return null;
                          return (
                            <li key={id} className="flex items-center justify-between gap-2 rounded border border-ink-200 px-2 py-1.5 text-sm">
                              <span className="truncate text-ink-800">{ag.name}</span>
                              <span className="num shrink-0 text-xs text-ink-500">{ag.app_count} apps</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="label mb-1.5">DPMs a notificar</h3>
                    {b.dpms.length === 0 ? (
                      <p className="text-sm text-ink-500">Ningun DPM confirmado entre las aplicaciones afectadas.</p>
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

                {/* R4 — lo no resuelto se lista aparte, no se descarta. */}
                {b.unroutableApps.length > 0 ? (
                  <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
                    <h3 className="text-sm font-semibold text-amber-900">Sin ruta de respuesta declarada</h3>
                    <p className="mt-0.5 text-xs text-amber-800">
                      <InlineMetric resolved={b.unroutableApps.length} universe={b.unionCount} /> de las
                      aplicaciones afectadas no tienen Assignment Group. Un incidente en esta plataforma no
                      encuentra destino para esas aplicaciones.
                    </p>
                    <ul className="scroll-thin mt-2 max-h-52 space-y-1 overflow-y-auto pr-1">
                      {b.unroutableApps.map((a) => (
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

              <section className="card card-pad">
                <SectionHeader title="Aplicaciones en el radio" >
                  <Link href="/" className="btn">Ver en el portafolio completo</Link>
                </SectionHeader>
                <div className="scroll-thin max-h-[420px] overflow-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 border-b border-ink-200 bg-ink-50">
                      <tr>
                        <th className="th">Aplicacion</th>
                        <th className="th">Proceso</th>
                        <th className="th">Sector</th>
                        <th className="th">Criticidad</th>
                        <th className="th">DPM</th>
                        <th className="th">AGs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {b.apps.map((a) => (
                        <tr key={a.app_id} className="row-hover">
                          <td className="td max-w-[260px] truncate"><AppLink appId={a.app_id} name={a.name} /></td>
                          <td className="td"><TbdValue value={a.process} /></td>
                          <td className="td"><TbdValue value={a.sector} /></td>
                          <td className="td"><CriticalityChip value={a.criticality} /></td>
                          <td className="td max-w-[150px] truncate"><TbdValue value={a.dpm} /></td>
                          <td className="td">{a.ags.length > 0 ? <span className="num">{a.ags.length}</span> : <NotRoutableTag />}</td>
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
