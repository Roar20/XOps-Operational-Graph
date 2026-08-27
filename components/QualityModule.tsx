"use client";
import { useMemo, useState } from "react";
import { quality, meta } from "@/lib/data";
import type { Granularity, QualityMetricKey } from "@/lib/types";
import { DeltaCard } from "./DeltaMetric";
import { CoverageCompareChart, DecalogoChart, MetricLine } from "./QualityCharts";
import { InlineMetric, Metric } from "./Metric";
import { ReadingNote, SectionHeader } from "./SectionHeader";

const GRAN: { key: Granularity; label: string }[] = [
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "quarter", label: "Trimestre" },
  { key: "year", label: "Ano" },
];

const PANELS: { key: QualityMetricKey; label: string; unit: string }[] = [
  { key: "diagnostic_rate", label: "Tasa diagnostica", unit: "%" },
  { key: "has_root_rate", label: "Con causa raiz", unit: "%" },
  { key: "has_res_rate", label: "Con resolucion descrita", unit: "%" },
  { key: "avg_score", label: "Score promedio", unit: " pts" },
  { key: "poor_critical_rate", label: "Poor en criticos", unit: "%" },
  { key: "reopen_rate", label: "Tasa de reapertura", unit: "%" },
];

type AgSort = "diagnostic_rate" | "has_root_rate" | "avg_score" | "poor_rate" | "incidents";

/**
 * Criterio 10 — La regla de elegibilidad y el corpus son visibles junto a toda
 * cifra de calidad. Este bloque acompana cada seccion del modulo.
 */
function CorpusStamp({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`${compact ? "text-[11px]" : "text-xs"} leading-snug text-ink-500`}>
      Corpus elegible <InlineMetric resolved={quality.corpus_eligible} universe={quality.corpus_total} /> incidentes ·
      scorer <span className="num font-medium text-ink-700">{quality.scorer}</span> · solo Closed y Resolved,
      excluyendo {quality.eligibility_rule.excluded_close_codes.join(", ")}.
    </p>
  );
}

export function QualityModule() {
  const [gran, setGran] = useState<Granularity>("month");
  const [agSort, setAgSort] = useState<AgSort>("diagnostic_rate");
  const [agDesc, setAgDesc] = useState(false);
  const [agLimit, setAgLimit] = useState(25);
  const [patLimit, setPatLimit] = useState(25);
  const [sopOnly, setSopOnly] = useState(false);

  // Criterio 11 — conmuta las cuatro series sin recargar la pagina.
  const series = quality.timeseries[gran];

  const agRows = useMemo(() => {
    const arr = [...quality.by_assignment_group];
    const dir = agDesc ? -1 : 1;
    arr.sort((a, b) => dir * (a[agSort] - b[agSort]));
    return arr;
  }, [agSort, agDesc]);

  // Criterio 12 — candidato a SOP: volumen alto con tasa diagnostica baja.
  // Los umbrales se derivan del propio corpus y se declaran en pantalla.
  const { volumeThreshold, diagThreshold, patterns, sopCount } = useMemo(() => {
    const counts = [...quality.recurrent_patterns.map((p) => p.count)].sort((a, b) => a - b);
    const vT = counts[Math.floor(counts.length * 0.75)];
    const dT = 30;
    const rows = quality.recurrent_patterns.map((p) => ({
      ...p, isSop: p.count >= vT && p.diagnostic_rate < dT,
    }));
    return {
      volumeThreshold: vT, diagThreshold: dT, patterns: rows,
      sopCount: rows.filter((r) => r.isSop).length,
    };
  }, []);

  const shownPatterns = sopOnly ? patterns.filter((p) => p.isSop) : patterns;

  const decalogoData = quality.decalogo.buckets.map((b) => ({
    label: `${b.code} ${b.label}`,
    count: b.count,
    pct: (b.count / quality.decalogo.classified) * 100,
  }));

  const th = (key: AgSort, label: string) => (
    <th className="th">
      <button
        type="button"
        onClick={() => { if (agSort === key) setAgDesc((d) => !d); else { setAgSort(key); setAgDesc(key !== "poor_rate"); } }}
        className="inline-flex items-center gap-1 hover:text-ink-900"
      >
        {label}
        <span className={agSort === key ? "text-ink-900" : "text-ink-300"}>{agSort === key ? (agDesc ? "▼" : "▲") : "↕"}</span>
      </button>
    </th>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Work Notes Quality</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-600">
          Calidad de la documentacion de incidentes medida con un solo instrumento. Corte {meta.as_of}.
        </p>
      </div>

      {/* R6 + R7 — instrumento y denominador, declarados antes de cualquier cifra. */}
      <section className="card card-pad">
        <SectionHeader kicker="Reglas R6 y R7" title="Instrumento y denominador" />
        <div className="grid gap-5 lg:grid-cols-3">
          <Metric
            label="Corpus elegible"
            resolved={quality.corpus_eligible}
            universe={quality.corpus_total}
            unitLabel="incidentes"
          />
          <div>
            <div className="label">Scorer canonico</div>
            <div className="num text-2xl font-semibold text-ink-900">{quality.scorer}</div>
            <div className="subtle mt-0.5">Un solo instrumento. No se mezclan bandas de scorers distintos.</div>
          </div>
          <div>
            <div className="label">Ventanas de comparacion</div>
            <div className="num text-sm font-semibold text-ink-900">
              {quality.baseline_window.from} → {quality.baseline_window.to}
            </div>
            <div className="num text-sm text-ink-600">
              vs {quality.current_window.from} → {quality.current_window.to}
            </div>
            <div className="subtle mt-0.5">Base posterior al quiebre de practica (R8).</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-md border border-ink-200 bg-ink-50 p-3">
            <h3 className="label mb-1">Regla de elegibilidad (R7)</h3>
            <p className="text-xs leading-relaxed text-ink-700">{quality.eligibility_rule.statement}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {quality.eligibility_rule.excluded_close_codes.map((c) => (
                <span key={c} className="rounded border border-ink-300 bg-white px-1.5 py-0.5 text-[10px] text-ink-600 line-through">{c}</span>
              ))}
            </div>
            <p className="mt-2 text-xs font-medium text-ink-800">{quality.eligibility_rule.effect_note}</p>
          </div>

          <div className="rounded-md border border-ink-200 bg-ink-50 p-3">
            <h3 className="label mb-1">Por que un solo instrumento (R6)</h3>
            <p className="text-xs leading-relaxed text-ink-700">
              Aplicar la regla binaria de <span className="num">incidentes_clasificados.xlsx</span> al corpus grande
              produce promedios divergentes. El desacuerdo se concentra en la banda baja, que es justo donde se
              medira la mejora.
            </p>
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-ink-500">
                  <th className="py-1 text-left font-medium">Banda</th>
                  <th className="py-1 text-right font-medium">{quality.scorer}</th>
                  <th className="py-1 text-right font-medium">Regla binaria</th>
                  <th className="py-1 text-right font-medium">Desacuerdo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200">
                {quality.band_divergence?.map((b) => (
                  <tr key={b.band}>
                    <td className="py-1 text-ink-800">{b.band}</td>
                    <td className="num py-1 text-right font-medium text-ink-900">{b.qn_v242.toFixed(1)}</td>
                    <td className="num py-1 text-right text-ink-400">{b.binary_xlsx.toFixed(1)}</td>
                    <td className="num py-1 text-right text-ink-600">{Math.abs(b.qn_v242 - b.binary_xlsx).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="subtle mt-1.5">Solo la columna {quality.scorer} alimenta esta pantalla.</p>
          </div>
        </div>
      </section>

      {/* Linea base y delta */}
      <section>
        <SectionHeader kicker="Regla R8" title="Linea base y delta">
          <CorpusStamp compact />
        </SectionHeader>
        <ReadingNote>{quality.break_note}</ReadingNote>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quality.baseline_metrics.map((m) => <DeltaCard key={m.key} m={m} />)}
        </div>
        <p className="subtle mt-2">
          El color del delta responde al campo <span className="num">direccion_deseada</span>, no al signo:
          una caida de <span className="num">poor_critical_rate</span> o de <span className="num">reopen_rate</span>{" "}
          se pinta como mejora.
        </p>
      </section>

      {/* Series de tiempo */}
      <section>
        <SectionHeader kicker={`Granularidad · ${series.length} periodos`} title="Evolucion de las metricas">
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Granularidad">
            {GRAN.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setGran(g.key)}
                aria-pressed={gran === g.key}
                className={`btn ${gran === g.key ? "btn-active" : ""}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </SectionHeader>

        <div className="card card-pad">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink-900">
              Tasa diagnostica <span className="font-normal text-ink-500">— % de incidentes con diagnostico documentado</span>
            </h3>
            <span className="subtle">Sombreado: ventana base · linea punteada: quiebre 2025Q3</span>
          </div>
          <MetricLine
            data={series}
            metricKey="diagnostic_rate"
            label="Tasa diagnostica"
            height={260}
            breakPeriod={gran === "quarter" ? "2025Q3" : gran === "month" ? "2025-07" : undefined}
            baselineFrom={gran === "month" ? "2025-08" : gran === "quarter" ? "2025Q3" : undefined}
            baselineTo={gran === "month" ? "2026-01" : gran === "quarter" ? "2025Q4" : undefined}
          />
          <CorpusStamp />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PANELS.map((p) => (
            <div key={p.key} className="card card-pad">
              <h3 className="text-sm font-semibold text-ink-900">{p.label}</h3>
              <p className="subtle mb-1">
                {p.key === "poor_critical_rate" || p.key === "reopen_rate" ? "Mejora a la baja" : "Mejora a la alza"}
              </p>
              <MetricLine data={series} metricKey={p.key} label={p.label} unit={p.unit} />
            </div>
          ))}
        </div>
      </section>

      {/* Ranking por Assignment Group */}
      <section>
        <SectionHeader
          kicker={`${quality.by_assignment_group.length} grupos con al menos ${quality.ag_min_incidents} incidentes`}
          title="Ranking por Assignment Group"
        >
          <CorpusStamp compact />
        </SectionHeader>
        <div className="card overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="th">#</th>
                  <th className="th">Assignment Group</th>
                  {th("incidents", "Incidentes")}
                  {th("diagnostic_rate", "Tasa diagnostica")}
                  {th("has_root_rate", "Con causa raiz")}
                  {th("avg_score", "Score promedio")}
                  {th("poor_rate", "Tasa Poor")}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {agRows.slice(0, agLimit).map((r, i) => (
                  <tr key={r.ag_key} className="row-hover">
                    <td className="num td text-ink-400">{i + 1}</td>
                    <td className="td max-w-[320px] truncate font-medium">{r.name}</td>
                    <td className="num td">{r.incidents.toLocaleString("es-MX")}</td>
                    <td className="num td">{r.diagnostic_rate.toFixed(1)}%</td>
                    <td className="num td">{r.has_root_rate.toFixed(1)}%</td>
                    <td className="num td">{r.avg_score.toFixed(1)}</td>
                    <td className="num td">{r.poor_rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-ink-200 bg-ink-50 px-3 py-2 text-center">
            {agLimit < agRows.length ? (
              <button type="button" className="btn" onClick={() => setAgLimit((l) => l + 50)}>
                Mostrar mas — {agLimit} de {agRows.length}
              </button>
            ) : (
              <span className="subtle num">{agRows.length} grupos</span>
            )}
          </div>
        </div>
      </section>

      {/* Incidentes recurrentes */}
      <section>
        <SectionHeader
          kicker={`${quality.recurrent_patterns.length} patrones`}
          title="Incidentes recurrentes"
        >
          <label className="inline-flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={sopOnly} onChange={(e) => { setSopOnly(e.target.checked); setPatLimit(25); }} className="rounded border-ink-300" />
            Solo candidatos a SOP
          </label>
        </SectionHeader>

        {/* Criterio 12 — la lectura operativa esta explicita en pantalla. */}
        <ReadingNote tone="warn">
          Un patron que combina <strong>volumen alto</strong> con <strong>tasa diagnostica baja</strong> es
          candidato a automatizacion o a SOP: se repite lo suficiente para justificar el esfuerzo y hoy se
          resuelve sin dejar diagnostico. Umbrales aplicados, derivados del propio corpus: volumen ≥{" "}
          <span className="num font-semibold">{volumeThreshold.toLocaleString("es-MX")}</span> (percentil 75) y
          tasa diagnostica &lt; <span className="num font-semibold">{diagThreshold}%</span>. Cumplen{" "}
          <InlineMetric resolved={sopCount} universe={quality.recurrent_patterns.length} /> patrones.
        </ReadingNote>

        <div className="card mt-3 overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="th">Patron</th>
                  <th className="th">Conteo</th>
                  <th className="th">AGs que lo tocan</th>
                  <th className="th">Tasa diagnostica</th>
                  <th className="th">Primera</th>
                  <th className="th">Ultima</th>
                  <th className="th">Lectura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {shownPatterns.slice(0, patLimit).map((p) => (
                  <tr key={p.pattern_id} className={`align-top ${p.isSop ? "bg-amber-50" : "row-hover"}`}>
                    <td className="td max-w-[360px] whitespace-normal">
                      <div className="font-medium text-ink-900">{p.pattern}</div>
                      <div className="subtle mt-0.5 line-clamp-2">{p.example}</div>
                    </td>
                    <td className="num td">{p.count.toLocaleString("es-MX")}</td>
                    <td className="num td">{p.ag_count}</td>
                    <td className="num td">{p.diagnostic_rate.toFixed(1)}%</td>
                    <td className="num td text-xs text-ink-500">{p.first_seen}</td>
                    <td className="num td text-xs text-ink-500">{p.last_seen}</td>
                    <td className="td">
                      {p.isSop ? (
                        <span className="inline-flex items-center rounded border border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
                          Candidato a SOP
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {shownPatterns.length === 0 ? (
                  <tr><td colSpan={7} className="td py-6 text-center text-ink-500">Ningun patron cumple el filtro.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="border-t border-ink-200 bg-ink-50 px-3 py-2 text-center">
            {patLimit < shownPatterns.length ? (
              <button type="button" className="btn" onClick={() => setPatLimit((l) => l + 50)}>
                Mostrar mas — {patLimit} de {shownPatterns.length}
              </button>
            ) : (
              <span className="subtle num">{shownPatterns.length} de {quality.recurrent_patterns.length} patrones</span>
            )}
          </div>
        </div>
      </section>

      {/* Decalogo */}
      <section>
        <SectionHeader kicker="Clasificacion" title="Distribucion de Decalogo">
          <CorpusStamp compact />
        </SectionHeader>
        <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="card card-pad">
            {/* La cobertura de 23.0% es visible como denominador. */}
            <Metric
              label="Cobertura de clasificacion"
              resolved={quality.decalogo.classified}
              universe={quality.decalogo.universe}
              unitLabel="incidentes elegibles clasificados"
            />
            <ReadingNote>
              El <span className="num font-semibold">{quality.decalogo.coverage_pct.toFixed(1)}%</span> de cobertura
              es el denominador de esta distribucion: los porcentajes de abajo se leen sobre los{" "}
              <span className="num">{quality.decalogo.classified.toLocaleString("es-MX")}</span> incidentes
              clasificados, no sobre el corpus completo.
            </ReadingNote>
          </div>
          <div className="card card-pad">
            <DecalogoChart data={decalogoData} />
            <CorpusStamp />
          </div>
        </div>
      </section>
    </div>
  );
}

export { CoverageCompareChart };
