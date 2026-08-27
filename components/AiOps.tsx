"use client";
import { useMemo } from "react";
import { applications, meta, coverage } from "@/lib/data";
import { aiApps, aiTechStack, subsetCoverage, computeGaps } from "@/lib/selectors";
import { CoverageCompareChart } from "./QualityCharts";
import { Metric, InlineMetric } from "./Metric";
import { ReadingNote, SectionHeader } from "./SectionHeader";
import { PortfolioTable } from "./PortfolioTable";
import { AiTag } from "./Chips";

/**
 * Quinta pantalla. Vista filtrada con narrativa propia: reutiliza los mismos
 * componentes que el resto de la app, no un modelo aparte.
 */
export function AiOps() {
  const aiCov = useMemo(() => subsetCoverage(aiApps), []);
  const allCov = useMemo(() => subsetCoverage(applications), []);
  const gaps = useMemo(() => computeGaps(aiApps), []);
  const stack = useMemo(() => aiTechStack(), []);

  const chartData = aiCov.map((c, i) => ({
    link: c.id,
    aiPct: c.coverage_pct,
    portfolioPct: allCov[i].coverage_pct,
  }));

  // El eslabon con la brecha mas grande contra el portafolio completo, y el
  // eslabon con la cobertura absoluta mas baja del segmento. Ambos se derivan de
  // los datos: la pantalla no afirma un hallazgo que la cifra no sostenga.
  const gaps4 = aiCov.map((c, i) => ({ ...c, delta: c.coverage_pct - allCov[i].coverage_pct }));
  const worst = [...gaps4].sort((a, b) => a.delta - b.delta)[0];
  const lowestAbs = [...aiCov].sort((a, b) => a.coverage_pct - b.coverage_pct)[0];
  const routing = aiCov.find((c) => c.id === "L4")!;
  const routingPortfolio = allCov.find((c) => c.id === "L4")!;
  const routingBelowPortfolio = routing.coverage_pct < routingPortfolio.coverage_pct;
  const declaredL4 = coverage.find((c) => c.id === "L4");

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">AI Ops</h1>
          <AiTag />
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-600">
          El portafolio incluye <InlineMetric resolved={aiApps.length} universe={meta.universe_apps} /> aplicaciones
          marcadas AI/ML, con su propio perfil de cobertura y su propia pila tecnologica. Corte {meta.as_of}.
        </p>
      </div>

      {/* El hallazgo que la pantalla debe hacer evidente. */}
      <section className="card card-pad border-amber-300 bg-amber-50/50">
        <SectionHeader kicker="El hallazgo" title="La capa de atribucion de AI/ML no esta cerrada" />
        <div className="grid gap-5 sm:grid-cols-3">
          <Metric label="Ruteables" resolved={gaps.routable} universe={aiApps.length} unitLabel="con Assignment Group" />
          <Metric label="Con DPM confirmado" resolved={gaps.owned} universe={aiApps.length} unitLabel="dueno declarado" />
          <Metric
            label="Con plataforma identificada"
            resolved={aiApps.length - gaps.withoutPlatform}
            universe={aiApps.length}
            unitLabel="stack resuelto"
          />
        </div>
        <div className="mt-3">
          <ReadingNote tone="warn">
            El eslabon mas debil del segmento es <strong>{lowestAbs.link}</strong>, resuelto en{" "}
            <InlineMetric resolved={lowestAbs.resolved} universe={lowestAbs.universe} />, y es tambien donde la
            brecha contra el portafolio es mayor ({worst.delta.toFixed(1)} pp en {worst.link}). El ruteo esta en{" "}
            <InlineMetric resolved={routing.resolved} universe={routing.universe} />
            {routingBelowPortfolio
              ? ", por debajo del portafolio completo"
              : ", cifra baja en terminos absolutos aunque no por debajo del portafolio completo"}
            . Es coherente con que el catalogo de actividades L1.5 del Cluster 06 aun no esta declarado. No es un
            defecto de captura que se pueda maquillar: es el argumento de por que AI Ops necesita cerrar su capa
            de atribucion <strong>antes</strong> de entrar a soporte gobernado. Hoy{" "}
            <InlineMetric resolved={gaps.withoutAg} universe={aiApps.length} /> aplicaciones AI/ML no tienen
            destino de ticket declarado.
          </ReadingNote>
        </div>
      </section>

      {/* Comparativo de cobertura en un solo grafico. */}
      <section>
        <SectionHeader kicker="Los cuatro eslabones" title="Cobertura AI/ML contra el portafolio completo" />
        <div className="card card-pad">
          <CoverageCompareChart data={chartData} />
          <div className="scroll-thin mt-3 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="th">Eslabon</th>
                  <th className="th">AI/ML</th>
                  <th className="th">Portafolio completo</th>
                  <th className="th">Brecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {aiCov.map((c, i) => {
                  const d = c.coverage_pct - allCov[i].coverage_pct;
                  return (
                    <tr key={c.id} className="row-hover">
                      <td className="td">
                        <span className="num mr-1.5 rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-bold text-ink-700">{c.id}</span>
                        {c.link}
                      </td>
                      <td className="num td">{c.resolved} de {c.universe} ({c.coverage_pct.toFixed(1)}%)</td>
                      <td className="num td text-ink-600">{allCov[i].resolved} de {allCov[i].universe} ({allCov[i].coverage_pct.toFixed(1)}%)</td>
                      <td className={`num td font-medium ${d < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                        {d > 0 ? "+" : ""}{d.toFixed(1)} pp
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="subtle mt-2">
            Ambas series se miden contra su propio universo y ambos denominadores estan a la vista:{" "}
            {aiApps.length} aplicaciones AI/ML y {applications.length} del portafolio. La brecha mayor esta en{" "}
            <strong>{worst.link}</strong> ({worst.delta.toFixed(1)} pp).
          </p>
          {/* R4 — la diferencia entre registro y ruteo se declara, no se promedia. */}
          <div className="mt-2">
            <ReadingNote>
              Las dos series se recalculan con el mismo criterio de compuerta sobre cada universo, por lo tanto son
              comparables entre si. No coinciden con las tarjetas de Portfolio Health porque aquellas publican los
              eslabones declarados del modelo: L4, por ejemplo, reporta{" "}
              {declaredL4 ? (
                <InlineMetric resolved={declaredL4.resolved} universe={declaredL4.universe} />
              ) : null}{" "}
              de presencia en CMDB, mientras que aqui se mide el AG declarado en el alcance. Registro no es ruteo,
              y la diferencia se muestra en lugar de promediarse.
            </ReadingNote>
          </div>
        </div>
      </section>

      {/* Pila tecnologica del portafolio AI/ML. */}
      <section>
        <SectionHeader
          kicker={`Derivada de Technology Stack · ${stack.length} plataformas con presencia AI/ML`}
          title="Pila tecnologica del portafolio AI/ML"
        />
        <div className="card overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="th">Plataforma</th>
                  <th className="th">Apps AI/ML</th>
                  <th className="th">Apps totales en la plataforma</th>
                  <th className="th">Tier</th>
                  <th className="th">Marcada is_ai_platform</th>
                  <th className="th">Ruteables</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {stack.map(({ platform: p, aiCount }) => (
                  <tr key={p.platform_id} className="row-hover">
                    <td className="td font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {p.name}
                        {p.is_ai_platform ? <AiTag /> : null}
                      </span>
                    </td>
                    <td className="num td font-semibold">{aiCount}</td>
                    <td className="num td text-ink-600">{p.blast_radius_direct}</td>
                    <td className="td text-ink-600">{p.tier}</td>
                    <td className="td">{p.is_ai_platform ? "Si" : <span className="text-ink-400">No</span>}</td>
                    <td className="num td">
                      {p.routable_apps} de {p.blast_radius_direct} ({p.routable_pct.toFixed(1)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-2">
          {/* R9 — la derivacion se declara como derivacion. */}
          <ReadingNote>
            Esta pila viene de normalizar el campo de texto libre <span className="num">Technology Stack</span>,
            por lo tanto es una derivacion, no un dato de sistema de registro. La ficha de cada aplicacion expone
            la cadena original que produjo la clasificacion. Solo{" "}
            <InlineMetric resolved={aiApps.length - gaps.withoutPlatform} universe={aiApps.length} /> aplicaciones
            AI/ML tienen plataforma identificada, por lo tanto esta tabla describe una minoria del segmento y no
            debe leerse como el inventario completo del stack.
          </ReadingNote>
        </div>
      </section>

      {/* Reutiliza el componente del portafolio, filtrado al segmento. */}
      <section>
        <SectionHeader kicker="Mismo componente que Portfolio Health" title="Las 142 aplicaciones AI/ML" />
        <PortfolioTable pool={aiApps} title="Aplicaciones AI/ML" />
      </section>
    </div>
  );
}
