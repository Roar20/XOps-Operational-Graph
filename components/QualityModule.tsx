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

/* Nombre legible y unidad de cada metrica. El scorer canonico es uno solo:
   QN v2.4.2. Nada en esta pantalla mezcla instrumentos. */
const METRICS: { key: QualityMetricKey; label: string; unit: "pp" | "pts"; hint: string }[] = [
  { key: "diagnostic_rate", label: "Tasa diagnóstica", unit: "pp", hint: "Incidentes con causa raíz y documentación de resolución." },
  { key: "has_root_rate", label: "Con causa raíz", unit: "pp", hint: "Root Cause > 0." },
  { key: "has_res_rate", label: "Con documentación de resolución", unit: "pp", hint: "Resolution Docs > 0." },
  { key: "avg_score", label: "Score promedio QN v2.4.2", unit: "pts", hint: "Puntaje del scorer canónico, 0–100." },
  { key: "poor_critical_rate", label: "Documentación pobre en críticos", unit: "pp", hint: "Banda Baja sobre incidentes de prioridad crítica." },
  { key: "reopen_rate", label: "Tasa de reapertura", unit: "pp", hint: "Incidentes reabiertos." },
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

  /* Candidatos a SOP: alto volumen y baja tasa diagnostica. El criterio se
     declara con sus dos umbrales, calculados de la propia distribucion. */
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
          Qué tan bien se documenta lo que se resuelve. La calidad se mide sobre el corpus de incidentes por
          Assignment Group, con un único scorer canónico y una regla de elegibilidad escrita antes de fijar la
          línea base.
        </p>
        <p className="num subtle mt-1">
          {qm.corpus} · corte {qm.as_of} · instrumento {qm.instrument}
        </p>
      </header>

      {/* ---------- R6 · la elegibilidad es parte de la metrica ---------- */}
      <section className="card card-pad">
        <SectionHeader kicker="R6 · denominador" title="Corpus y regla de elegibilidad">
          <EvidenceBadge tier="E3" showAuthority />
        </SectionHeader>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Incidentes elegibles"
            resolved={qm.eligible}
            universe={qm.universe_raw}
            unitLabel="del corpus crudo"
          />
          <Metric
            label="Claves de AG unidas al corpus"
            resolved={qm.join_coverage.ags_matched}
            universe={qm.join_coverage.ags_bridge}
            unitLabel="claves distintas del modelo"
            tone="gap"
          />
          <Metric
            label="Aplicaciones alcanzadas por la medición"
            resolved={qm.join_coverage.apps_reached}
            universe={qm.join_coverage.apps_universe}
            unitLabel="vía sus AGs"
            tone="gap"
          />
          <Metric
            label="Plataformas alcanzadas"
            resolved={qm.join_coverage.platforms_reached}
            universe={qm.join_coverage.platforms_universe}
            unitLabel="vía sus AGs"
          />
        </div>
        <div className="mt-3 space-y-2">
          <Note>
            <strong>Regla de elegibilidad:</strong> {qm.eligibility_rule}
          </Note>
          <Note tone="warn">
            <strong>Efecto de la regla:</strong> {qm.eligibility_effect}
          </Note>
          <Note>
            <strong>Regla de calidad:</strong> {qm.quality_rule}
          </Note>
          <Note tone="warn">
            <strong>Alcance del join:</strong> {qm.join_note} Son dos catálogos distintos y no uno dentro del
            otro: el corpus trae <span className="num font-semibold">{qm.join_coverage.ags_quality}</span> grupos y
            el modelo <span className="num font-semibold">{TOTAL_AGS}</span> nombres que colapsan a{" "}
            <span className="num font-semibold">{qm.join_coverage.ags_bridge}</span> claves distintas (ver DQ1).
            Solo <span className="num font-semibold">{qm.join_coverage.ags_matched}</span> claves aparecen en
            ambos; el corpus unido cubre{" "}
            <span className="num font-semibold">{qm.join_coverage.incident_coverage_pct.toFixed(1)}%</span> de los
            incidentes elegibles. Toda calidad atribuida a una aplicación o a una plataforma es una aproximación{" "}
            <ApproxTag /> y así se etiqueta en las demás pantallas.
          </Note>
        </div>
      </section>

      {/* ---------- R7 · un solo instrumento, y el desacuerdo declarado ---------- */}
      <section className="card card-pad">
        <SectionHeader kicker="R7 · instrumento único" title="Scorer canónico QN v2.4.2">
          <button type="button" className="btn" onClick={() => setShowWarning((v) => !v)} aria-expanded={showWarning}>
            {showWarning ? "Ocultar" : "Ver"} desacuerdo entre instrumentos
          </button>
        </SectionHeader>
        <p className="text-sm text-ink-700">
          Todas las cifras de esta pantalla vienen de {qm.instrument}. No se promedian instrumentos ni se
          alterna entre ellos según convenga.
        </p>
        {showWarning ? (
          <div className="mt-3 space-y-3">
            <Note tone="warn">{qm.instrument_warning}</Note>
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-ink-200 bg-ink-50">
                  <tr>
                    <th className="th">Banda</th>
                    <th className="th text-right">QN v2.4.2 (canónico)</th>
                    <th className="th text-right">Regla binaria del xlsx</th>
                    <th className="th text-right">Diferencia</th>
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
          kicker={`R8 · línea base ${qm.baseline_window[0]} → ${qm.baseline_window[1]} · actual ${qm.current_window[0]} → ${qm.current_window[1]}`}
          title="Movimiento contra línea base"
        />
        <Note tone="warn">{qm.break_note}</Note>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quality.baseline_metrics.map((b) => (
            <div key={b.key} className="rounded border border-ink-200 p-3">
              <div className="label">{LABEL[b.key] ?? b.key}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="num text-xl font-semibold text-pep-900">{b.current.toFixed(1)}</span>
                <span className="subtle num">desde {b.baseline.toFixed(1)} {b.unit === "pts" ? "pts" : "%"}</span>
              </div>
              <div className="mt-1.5">
                <Delta value={b.delta} direction={b.direccion_deseada} unit={b.unit} />
              </div>
              <p className="subtle mt-1.5">
                Dirección deseada: {b.direccion_deseada === "up_is_good" ? "a la alza" : "a la baja"}. El color
                lee la dirección, no el signo.
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- serie temporal ---------- */}
      <section className="card card-pad">
        <SectionHeader kicker="Serie" title="Evolución de la calidad">
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
          {active.hint} La barra clara es el volumen de incidentes del periodo: la tasa nunca se muestra sin su
          denominador. La franja sombreada es la ventana de línea base, posterior al quiebre de práctica de 2025Q3.
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
          {points.length} periodos en granularidad {GRANULARITIES.find((g) => g.key === gran)?.label.toLowerCase()}.
          Los periodos con muy pocos incidentes se muestran tal cual, sin suavizado ni recorte.
        </p>
      </section>

      {/* ---------- ranking por AG ---------- */}
      <section className="card card-pad">
        <SectionHeader
          kicker={`${quality.by_assignment_group.length} grupos con corpus elegible`}
          title="Calidad por Assignment Group"
        >
          <label className="flex items-center gap-2 text-xs text-ink-700">
            Mínimo de incidentes
            <select
              className="input w-28"
              value={minIncidents}
              onChange={(e) => setMinIncidents(Number(e.target.value))}
            >
              {[0, 100, 500, 1000, 5000].map((v) => (
                <option key={v} value={v}>{v === 0 ? "sin filtro" : v.toLocaleString("es-MX")}</option>
              ))}
            </select>
          </label>
        </SectionHeader>

        <Note>
          Se listan los grupos con corpus elegible.{" "}
          <InlineMetric resolved={agRows.length} universe={quality.by_assignment_group.length} /> pasan el mínimo
          seleccionado. Los grupos sin corpus no se muestran aquí porque no tienen medición — no porque estén bien.
        </Note>

        <div className="mt-3 scroll-thin max-h-[520px] overflow-auto">
          <table className="w-full border-collapse">
            <TableCaption>
              Cada tasa se calcula sobre la columna <span className="num">Incidentes</span> de su propia fila.
              Los denominadores son distintos por grupo, así que las tasas se comparan pero no se promedian.
              El score es del scorer {qm.instrument}, en puntos sobre 100.
            </TableCaption>
            <thead className="sticky top-0 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Assignment Group</th>
                {([
                  ["incidents", "Incidentes"],
                  ["diagnostic_rate", "Tasa diagnóstica"],
                  ["has_root_rate", "Con causa raíz"],
                  ["avg_score", "Score QN v2.4.2"],
                  ["poor_rate", "Doc. pobre"],
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
                <th className="th text-right">Apps que atiende</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {agRows.map((r) => {
                const g = getAg(r.name);
                return (
                  <tr key={r.ag_key} className="row-hover">
                    <td className="td font-medium">{r.name}</td>
                    <td className="num td text-right">{r.incidents.toLocaleString("es-MX")}</td>
                    <td className="num td text-right">{r.diagnostic_rate.toFixed(1)}%</td>
                    <td className="num td text-right">{r.has_root_rate.toFixed(1)}%</td>
                    <td className="num td text-right">{r.avg_score.toFixed(1)}</td>
                    <td className="num td text-right">{r.poor_rate.toFixed(1)}%</td>
                    <td className="num td text-right text-ink-500">
                      {g ? g.app_count : <span className="text-ink-400">sin unir al modelo</span>}
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
          kicker={`${sopCandidates.rows.length} grupos cumplen los dos umbrales`}
          title="Candidatos a SOP"
        />
        <Note>
          Criterio declarado: volumen en el <span className="num">40%</span> superior
          (≥ <span className="num">{sopCandidates.volCut.toLocaleString("es-MX")}</span> incidentes) y tasa
          diagnóstica en el <span className="num">40%</span> inferior
          (≤ <span className="num">{sopCandidates.diagCut.toFixed(1)}%</span>). Los dos cortes salen de la
          distribución observada, no de un umbral elegido a mano. Alto volumen mal documentado es dónde un
          procedimiento estándar rinde primero; no es una lista de culpables.
        </Note>
        <div className="mt-3 scroll-thin max-h-[360px] overflow-auto">
          <table className="w-full border-collapse">
            <TableCaption>
              Tasas sobre la columna <span className="num">Incidentes</span> de cada fila. La pertenencia a esta
              lista se decide por los dos umbrales declarados arriba, no por el valor de una sola columna.
            </TableCaption>
            <thead className="sticky top-0 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Assignment Group</th>
                <th className="th text-right">Incidentes</th>
                <th className="th text-right">Tasa diagnóstica</th>
                <th className="th text-right">Score</th>
                <th className="th text-right">Doc. pobre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {sopCandidates.rows.map((r) => (
                <tr key={r.ag_key} className="row-hover">
                  <td className="td font-medium">{r.name}</td>
                  <td className="num td text-right">{r.incidents.toLocaleString("es-MX")}</td>
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
        <SectionHeader kicker={`Cobertura ${qm.decalogue_coverage_pct.toFixed(1)}% del corpus`} title="Decálogo" />
        <Note tone="warn">
          Solo <span className="num font-semibold">{qm.decalogue_coverage_pct.toFixed(1)}%</span> de los incidentes
          elegibles trae código del Decálogo. La categoría <span className="num">Sin código</span> se muestra en la
          gráfica en lugar de excluirse: es la categoría más grande y esconderla haría ver la clasificación mejor
          de lo que está.
        </Note>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <DecalogueChart rows={quality.by_decalogue} />
          <div className="scroll-thin max-h-[280px] overflow-auto">
            <table className="w-full border-collapse">
              <TableCaption>
                Tasas sobre la columna <span className="num">Incidentes</span> de cada código. La suma de la
                columna es el corpus elegible, {qm.eligible.toLocaleString("es-MX")} incidentes.
              </TableCaption>
              <thead className="sticky top-0 border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="th">Código</th>
                  <th className="th text-right">Incidentes</th>
                  <th className="th text-right">Score</th>
                  <th className="th text-right">Tasa diagnóstica</th>
                  <th className="th text-right">AGs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {quality.by_decalogue.map((d) => (
                  <tr key={d.dcode} className="row-hover">
                    <td className="td font-medium">{d.dcode}</td>
                    <td className="num td text-right">{d.incidents.toLocaleString("es-MX")}</td>
                    <td className="num td text-right">{d.avg_score.toFixed(1)}</td>
                    <td className="num td text-right">{d.diagnostic_rate.toFixed(1)}%</td>
                    <td className="num td text-right">{d.ags.toLocaleString("es-MX")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---------- patrones recurrentes ---------- */}
      <section className="card card-pad">
        <SectionHeader kicker={`${patterns.length} firmas recurrentes`} title="Patrones repetidos" />
        <Note>
          Firmas normalizadas del texto de incidentes. Una firma con muchos incidentes concentrada en un solo AG
          es trabajo repetido con dueño claro; repartida entre muchos AGs, es un síntoma compartido sin dueño.
          La firma es una derivación de texto libre, no un campo capturado.{" "}
          <EvidenceBadge tier="E3" showAuthority />
        </Note>
        <div className="mt-3 scroll-thin max-h-[420px] overflow-auto">
          <table className="w-full border-collapse">
            <TableCaption>
              La tasa diagnóstica de cada fila se calcula sobre la columna <span className="num">Incidentes</span>
              {" "}de esa firma, no sobre el corpus completo.
            </TableCaption>
            <thead className="sticky top-0 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Firma</th>
                <th className="th text-right">Incidentes</th>
                <th className="th text-right">AGs</th>
                <th className="th">AG principal</th>
                <th className="th text-right">Tasa diagnóstica</th>
                <th className="th">Visto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {patterns.slice(0, patternLimit).map((p) => (
                <tr key={p.sig} className="row-hover align-top">
                  <td className="td max-w-[320px] whitespace-normal">
                    <div className="font-medium">{p.sig}</div>
                    <div className="subtle num truncate">{p.example}</div>
                  </td>
                  <td className="num td text-right">{p.incidents.toLocaleString("es-MX")}</td>
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
            Ver las {patterns.length} firmas
          </button>
        ) : (
          <p className="subtle mt-2">Se muestran las {patterns.length} firmas, sin recorte.</p>
        )}
      </section>

      <p className="subtle">
        Corte del corpus {qm.as_of} · corte del modelo {meta.as_of} · universo de aplicaciones{" "}
        <span className="num">{UNIVERSE}</span> · plataformas <span className="num">{platforms.length}</span>.
      </p>
    </div>
  );
}
