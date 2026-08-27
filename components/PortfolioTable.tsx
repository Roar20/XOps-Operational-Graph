"use client";
import { useMemo, useState } from "react";
import {
  EMPTY_FILTERS, filterApps, computeGaps, PROCESS_OPTIONS, SECTOR_OPTIONS,
  SCOPE_OPTIONS, CRITICALITY_OPTIONS, PLATFORM_OPTIONS, type PortfolioFilters,
} from "@/lib/selectors";
import type { Application, Criticality } from "@/lib/types";
import { applications, UNIVERSE } from "@/lib/data";
import { AiTag, AppLink, CriticalityChip, GateChips, NotRoutableTag, SupportLoad, TbdValue } from "./Chips";
import { InlineMetric, Metric } from "./Metric";
import { ReadingNote, SectionHeader } from "./SectionHeader";

type SortKey = "name" | "criticality" | "platforms" | "ags" | "tickets" | "process";
const CRIT_ORDER: Record<Criticality, number> = { C1: 0, C2: 1, C3: 2, "C-": 3 };
const PAGE = 60;

export function PortfolioTable({ pool = applications, title = "Aplicaciones del portafolio" }: {
  pool?: Application[];
  title?: string;
}) {
  const [f, setF] = useState<PortfolioFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("name");
  const [desc, setDesc] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const set = <K extends keyof PortfolioFilters>(k: K, v: PortfolioFilters[K]) => {
    setF((prev) => ({ ...prev, [k]: v }));
    setLimit(PAGE);
  };

  const filtered = useMemo(() => filterApps(pool, f), [pool, f]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = desc ? -1 : 1;
    arr.sort((a, b) => {
      switch (sort) {
        case "criticality": return dir * (CRIT_ORDER[a.criticality] - CRIT_ORDER[b.criticality]);
        case "platforms": return dir * (a.platforms.length - b.platforms.length);
        case "ags": return dir * (a.ags.length - b.ags.length);
        // R3: los tickets se ordenan como carga de soporte, en su propia columna,
        // nunca combinados con criticidad.
        case "tickets": return dir * ((a.tickets_year ?? -1) - (b.tickets_year ?? -1));
        case "process": return dir * a.process.localeCompare(b.process);
        default: return dir * a.name.localeCompare(b.name);
      }
    });
    return arr;
  }, [filtered, sort, desc]);

  // Los numeros del hueco se calculan sobre los datos, nunca se escriben a mano.
  const gaps = useMemo(() => computeGaps(pool), [pool]);
  const gapsFiltered = useMemo(() => computeGaps(filtered), [filtered]);
  const activeFilters = Object.entries(f).filter(([k, v]) => v !== EMPTY_FILTERS[k as keyof PortfolioFilters]).length;

  const th = (key: SortKey, label: string, extra = "") => (
    <th className={`th ${extra}`}>
      <button
        type="button"
        onClick={() => { if (sort === key) setDesc((d) => !d); else { setSort(key); setDesc(key === "tickets" || key === "platforms" || key === "ags"); } }}
        className="inline-flex items-center gap-1 hover:text-ink-900"
      >
        {label}
        <span className={sort === key ? "text-ink-900" : "text-ink-300"}>{sort === key ? (desc ? "▼" : "▲") : "↕"}</span>
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Panel fijo: hueco declarado (R4). Todo calculado desde los datos. */}
      <section className="card card-pad border-amber-300 bg-amber-50/50">
        <SectionHeader kicker="Panel fijo" title="Hueco declarado" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Sin Assignment Group" resolved={gaps.withoutAg} universe={gaps.universe} unitLabel="no ruteables" />
          <Metric label="Sin DPM confirmado" resolved={gaps.withoutDpm} universe={gaps.universe} unitLabel="DPM en TBD" />
          <Metric label="Sin atribucion completa" resolved={gaps.withoutAttribution} universe={gaps.universe} unitLabel="proceso, sector o criticidad ausente" />
          <Metric label="Sin plataforma identificada" resolved={gaps.withoutPlatform} universe={gaps.universe} unitLabel="stack no resuelto" />
        </div>
        <ReadingNote tone="warn">
          Estas aplicaciones no se filtran fuera de la tabla: aparecen etiquetadas y cuentan en el hueco.
          Ruteables hoy: <InlineMetric resolved={gaps.routable} universe={gaps.universe} />. El resto no puede
          determinar el destino de un ticket.
        </ReadingNote>
      </section>

      <section>
        <SectionHeader
          kicker={`${activeFilters} filtro${activeFilters === 1 ? "" : "s"} activo${activeFilters === 1 ? "" : "s"}`}
          title={title}
        >
          <div className="flex items-center gap-2">
            <span className="subtle num">
              Mostrando <InlineMetric resolved={filtered.length} universe={pool.length} />
            </span>
            {activeFilters > 0 ? (
              <button type="button" className="btn" onClick={() => { setF(EMPTY_FILTERS); setLimit(PAGE); }}>
                Limpiar filtros
              </button>
            ) : null}
          </div>
        </SectionHeader>

        <div className="card card-pad mb-3">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <label className="block">
              <span className="label">Nombre o APM</span>
              <input className="input mt-1" value={f.q} onChange={(e) => set("q", e.target.value)} placeholder="Filtrar…" />
            </label>
            <Select label="Proceso" value={f.process} onChange={(v) => set("process", v)} options={PROCESS_OPTIONS} />
            <Select label="Sector" value={f.sector} onChange={(v) => set("sector", v)} options={SECTOR_OPTIONS} />
            <Select label="Criticidad" value={f.criticality} onChange={(v) => set("criticality", v)} options={CRITICALITY_OPTIONS} />
            <Select label="Scope status" value={f.scope} onChange={(v) => set("scope", v)} options={SCOPE_OPTIONS} />
            <label className="block">
              <span className="label">Plataforma</span>
              <select className="input mt-1" value={f.platform} onChange={(e) => set("platform", e.target.value)}>
                <option value="">Todas</option>
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p.platform_id} value={p.platform_id}>
                    {p.name} ({p.blast_radius_direct})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Estado de compuerta</span>
              <select className="input mt-1" value={f.gate} onChange={(e) => set("gate", e.target.value)}>
                <option value="">Cualquiera</option>
                <option value="routable">Ruteable</option>
                <option value="not-routable">No ruteable</option>
                <option value="owned">Con dueno</option>
                <option value="not-owned">Sin DPM confirmado</option>
                <option value="attributable">Atribuible</option>
                <option value="not-attributable">Sin atribucion completa</option>
              </select>
            </label>
          </div>
          <label className="mt-3 inline-flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={f.aiOnly} onChange={(e) => set("aiOnly", e.target.checked)} className="rounded border-ink-300" />
            Solo aplicaciones AI/ML
          </label>
        </div>

        {activeFilters > 0 ? (
          <div className="mb-3">
            <ReadingNote>
              En la seleccion actual: <InlineMetric resolved={gapsFiltered.withoutAg} universe={gapsFiltered.universe} /> sin AG ·{" "}
              <InlineMetric resolved={gapsFiltered.withoutDpm} universe={gapsFiltered.universe} /> con DPM en TBD.
            </ReadingNote>
          </div>
        ) : null}

        <div className="card overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  {th("name", "Aplicacion")}
                  <th className="th">APM</th>
                  {th("process", "Proceso")}
                  <th className="th">Sector</th>
                  {th("criticality", "Criticidad")}
                  <th className="th">DPM</th>
                  {th("platforms", "Plataformas")}
                  {th("ags", "AGs")}
                  {th("tickets", "Carga de soporte")}
                  <th className="th">Compuertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {sorted.slice(0, limit).map((a) => (
                  <tr key={a.app_id} className="row-hover align-middle">
                    <td className="td max-w-[280px]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate"><AppLink appId={a.app_id} name={a.name} /></span>
                        {a.is_ai_ml ? <AiTag /> : null}
                      </div>
                    </td>
                    <td className="td num text-ink-500">{a.apm}</td>
                    <td className="td"><TbdValue value={a.process} /></td>
                    <td className="td"><TbdValue value={a.sector} /></td>
                    <td className="td"><CriticalityChip value={a.criticality} /></td>
                    <td className="td max-w-[160px] truncate"><TbdValue value={a.dpm} /></td>
                    <td className="td num">{a.platforms.length || <span className="text-ink-400">0</span>}</td>
                    <td className="td">
                      {a.ags.length > 0
                        ? <span className="num">{a.ags.length}</span>
                        : <NotRoutableTag />}
                    </td>
                    {/* R3: sin semaforo. Un solo color, cualquiera que sea el volumen. */}
                    <td className="td"><SupportLoad value={a.tickets_year} showLabel={false} /></td>
                    <td className="td"><GateChips gates={a.gates} /></td>
                  </tr>
                ))}
                {sorted.length === 0 ? (
                  <tr><td colSpan={10} className="td py-8 text-center text-ink-500">Ninguna aplicacion cumple los filtros.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {limit < sorted.length ? (
            <div className="border-t border-ink-200 bg-ink-50 px-3 py-2 text-center">
              <button type="button" className="btn" onClick={() => setLimit((l) => l + PAGE * 2)}>
                Mostrar mas — {limit} de {sorted.length} visibles
              </button>
            </div>
          ) : (
            <div className="border-t border-ink-200 bg-ink-50 px-3 py-2 text-center subtle num">
              {sorted.length} de {UNIVERSE} aplicaciones del universo
            </div>
          )}
        </div>
        <p className="subtle mt-2">
          Carga de soporte es <span className="num">tickets_year</span> y es un eje de costo, no de riesgo (R3):
          no se colorea ni se combina con criticidad.
        </p>
      </section>
    </div>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: readonly string[];
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="input mt-1" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Todos</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
