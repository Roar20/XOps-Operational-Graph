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
    () => aiApps.filter((a) => a.ags.length === 0).sort((a, b) => a.name.localeCompare(b.name, "es")),
    [],
  );
  const shown = onlyUnrouted ? unrouted : [...aiApps].sort((a, b) => a.name.localeCompare(b.name, "es"));

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
          El segmento AI/ML del portafolio, medido con los mismos cuatro eslabones que el resto. La brecha con el
          portafolio completo es el mensaje de esta pantalla, no un defecto que haya que suavizar.
        </p>
      </header>

      {/* ---------- las cuatro cifras de cabecera, cada una con su denominador ---------- */}
      <section className="card card-pad">
        <SectionHeader kicker={`Cluster 06 · ${aiApps.length} aplicaciones AI/ML`} title="Cobertura del segmento" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Aplicaciones AI/ML" resolved={aiApps.length} universe={UNIVERSE} unitLabel="del portafolio" />
          <Metric label="Con Assignment Group" resolved={aiGaps.routable} universe={aiApps.length} unitLabel="ruteables" tone="gap" />
          <Metric label="Con DPM declarado" resolved={aiGaps.owned} universe={aiApps.length} unitLabel="con dueño" />
          <Metric label="Con plataforma identificada" resolved={aiGaps.platformKnown} universe={aiApps.length} unitLabel="ubicadas" tone="gap" />
        </div>
        <Note tone="warn" >
          <span className="mt-3 block">
            {meta.ai_ops.note} Con el dato a la vista: el ruteo del segmento está en{" "}
            <InlineMetric resolved={aiGaps.routable} universe={aiApps.length} /> contra{" "}
            <InlineMetric resolved={allGaps.routable} universe={allGaps.universe} /> del portafolio completo, una
            diferencia de{" "}
            <span className="num font-semibold">
              {((aiGaps.routable / aiApps.length - allGaps.routable / allGaps.universe) * 100).toFixed(1)} pp
            </span>
            . Las dos cifras se muestran con su propio denominador porque los universos son distintos y no son
            comparables como conteos.
          </span>
        </Note>
      </section>

      {/* ---------- comparativo por eslabon ---------- */}
      <section className="card card-pad">
        <SectionHeader kicker="Los cuatro eslabones" title="AI/ML contra el portafolio completo" />
        <p className="subtle mb-3">
          Cada barra es una proporción sobre su propio universo: {aiApps.length} aplicaciones AI/ML frente a{" "}
          {UNIVERSE} del portafolio. Nunca se restan ni se suman entre sí.
        </p>
        <CoverageCompareChart rows={chartRows} />
        <div className="mt-3 scroll-thin overflow-x-auto">
          <table className="w-full border-collapse">
            <TableCaption>
              Dos universos distintos por fila: {aiApps.length} aplicaciones AI/ML y {UNIVERSE} del portafolio.
              La diferencia está en puntos porcentuales entre las dos proporciones y no es un conteo.
            </TableCaption>
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Eslabón</th>
                <th className="th">AI/ML</th>
                <th className="th">Portafolio completo</th>
                <th className="th text-right">Diferencia</th>
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
          La diferencia se expresa en puntos porcentuales entre dos proporciones de distinto universo. No es un
          conteo y no se puede sumar a nada.
        </p>
      </section>

      {/* ---------- pila tecnologica ---------- */}
      <section className="card card-pad">
        <SectionHeader
          kicker={`${aiPlatforms.length} plataformas marcadas como AI · ${aiTechStack.length} plataformas con al menos una app AI/ML`}
          title="Pila tecnológica del segmento"
        >
          <EvidenceBadge tier="E2" showAuthority />
        </SectionHeader>
        <Note>
          Una aplicación AI/ML puede correr sobre plataformas que no son de AI, y una plataforma de AI puede
          alojar aplicaciones que no lo son. Se listan las dos cosas por separado en lugar de fundirlas.{" "}
          <InlineMetric resolved={aiGaps.platformKnown} universe={aiApps.length} /> de las aplicaciones AI/ML
          tienen plataforma identificada, así que esta pila describe solo a esas.
        </Note>
        <div className="mt-3 scroll-thin overflow-x-auto">
          <table className="w-full border-collapse">
            <TableCaption>
              «Ruteables» es la proporción de las apps de esa plataforma con Assignment Group: el denominador es
              la columna <span className="num">Apps totales</span> de la misma fila, no el portafolio.
            </TableCaption>
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Plataforma</th>
                <th className="th">Tier</th>
                <th className="th text-right">Apps AI/ML</th>
                <th className="th text-right">Apps totales</th>
                <th className="th text-right">Ruteables</th>
                <th className="th">Marcas</th>
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
        <SectionHeader kicker="Criticidad declarada" title="Qué tan crítico es el segmento — y cuánto no se sabe" />
        <div className="grid gap-4 sm:grid-cols-4">
          {critMix.map(({ c, n }) => (
            <div key={c} className="rounded border border-ink-200 p-3">
              <CriticalityChip value={c} withLabel />
              <div className="num mt-1.5 text-xl font-semibold text-pep-900">{n}</div>
              <div className="subtle num">de {aiApps.length} · {((n / aiApps.length) * 100).toFixed(1)}%</div>
            </div>
          ))}
        </div>
        <Note tone="warn">
          <span className="mt-3 block">
            <InlineMetric resolved={aiGaps.withoutCriticality} universe={aiApps.length} /> de las aplicaciones
            AI/ML no tienen criticidad declarada. No se imputa ninguna: una aplicación sin criticidad pesa cero en
            cualquier agregado ponderado, y eso no significa que no importe, significa que no se ha clasificado.
          </span>
        </Note>
      </section>

      {/* ---------- calidad aproximada del segmento ---------- */}
      <section className="card card-pad">
        <SectionHeader kicker="Calidad de work notes" title="Los grupos que atienden al segmento AI/ML">
          <ApproxTag>se mide por AG, no por aplicación</ApproxTag>
        </SectionHeader>
        <Note tone="warn">
          El segmento toca <span className="num font-semibold">{aiAgNames.length}</span> Assignment Groups
          distintos, de los cuales <InlineMetric resolved={q.measured} universe={aiAgNames.length} /> tienen corpus
          elegible. Estas cifras describen a esos grupos, que también atienden aplicaciones fuera del segmento; no
          son la calidad de las aplicaciones AI/ML. En todo el modelo solo{" "}
          <InlineMetric
            resolved={quality.meta.join_coverage.ags_matched}
            universe={quality.meta.join_coverage.ags_bridge}
          />{" "}
          de las claves de grupo se pudieron unir al corpus de calidad.
        </Note>
        {q.measured === 0 ? (
          <p className="mt-3 text-sm text-ink-600">
            Ninguno de los grupos que atienden al segmento alcanza el umbral de elegibilidad. No hay medición y no
            se sustituye por el promedio del portafolio.
          </p>
        ) : (
          <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Metric compact label="AGs con medición" resolved={q.measured} universe={aiAgNames.length} unitLabel="AGs del segmento" />
            <div>
              <div className="label">Tasa diagnóstica ponderada</div>
              <div className="num text-lg font-semibold text-pep-900">{q.diagnostic_rate?.toFixed(1)}%</div>
              <div className="subtle num mt-0.5">sobre {q.incidents.toLocaleString("es-MX")} incidentes</div>
            </div>
            <div>
              <div className="label">Con causa raíz</div>
              <div className="num text-lg font-semibold text-pep-900">{q.has_root_rate?.toFixed(1)}%</div>
              <div className="subtle num mt-0.5">sobre {q.incidents.toLocaleString("es-MX")} incidentes</div>
            </div>
            <div>
              <div className="label">Documentación pobre</div>
              <div className="num text-lg font-semibold text-pep-900">{q.poor_rate?.toFixed(1)}%</div>
              <div className="subtle num mt-0.5">sobre {q.incidents.toLocaleString("es-MX")} incidentes</div>
            </div>
          </div>
        )}
      </section>

      {/* ---------- la lista que no se filtra ---------- */}
      <section className="card card-pad">
        <SectionHeader
          kicker={`${shown.length} aplicaciones listadas`}
          title={onlyUnrouted ? "Aplicaciones AI/ML sin ruta de respuesta declarada" : "Todas las aplicaciones AI/ML"}
        >
          <div className="flex items-center gap-1">
            <button type="button" className={`btn ${onlyUnrouted ? "btn-active" : ""}`} onClick={() => setOnlyUnrouted(true)} aria-pressed={onlyUnrouted}>
              Sin AG <span className="num opacity-70">{unrouted.length}</span>
            </button>
            <button type="button" className={`btn ${!onlyUnrouted ? "btn-active" : ""}`} onClick={() => setOnlyUnrouted(false)} aria-pressed={!onlyUnrouted}>
              Todas <span className="num opacity-70">{aiApps.length}</span>
            </button>
          </div>
        </SectionHeader>

        <Note tone={onlyUnrouted ? "warn" : "neutral"}>
          {onlyUnrouted ? (
            <>
              <InlineMetric resolved={unrouted.length} universe={aiApps.length} /> de las aplicaciones AI/ML no
              tienen Assignment Group. Un incidente sobre cualquiera de ellas no encuentra destino. La lista se
              publica completa: no se ocultan las que además no tienen DPM ni plataforma.
            </>
          ) : (
            <>
              El segmento completo, incluidas las que no tienen ruta, dueño ni plataforma. Ninguna fila se
              excluye por estar incompleta.
            </>
          )}
        </Note>

        <div className="mt-3 scroll-thin max-h-[520px] overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Aplicación</th>
                <th className="th">Criticidad</th>
                <th className="th">Proceso</th>
                <th className="th">DPM</th>
                <th className="th text-right">Plataformas</th>
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
        Corte {meta.as_of}. El segmento AI/ML se identifica por la marca del inventario, no por inferencia sobre
        el nombre de la aplicación.
      </p>
    </div>
  );
}
