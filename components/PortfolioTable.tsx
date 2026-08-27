"use client";
import { useMemo, useState } from "react";
import {
  applications, computeGaps, filterApps, EMPTY_FILTERS, PROCESS_OPTIONS, SECTOR_OPTIONS,
  SCOPE_OPTIONS, CRITICALITY_OPTIONS, PLATFORM_OPTIONS, UNIVERSE, type Filters,
} from "@/lib/data";
import type { Application, Criticality } from "@/types";
import { AiTag, AppLink, CriticalityChip, GateChips, NotRoutableTag, SupportLoad, TbdValue } from "./Chips";
import { InlineMetric, Metric } from "./Metric";
import { Note, SectionHeader } from "./SectionHeader";

type SortKey = "name" | "criticality" | "platforms" | "ags" | "tickets" | "process" | "sector";
const CRIT_ORDER: Record<Criticality, number> = { C1: 0, C2: 1, C3: 2, "C-": 3 };
const PAGE = 60;

export function PortfolioTable({
  pool = applications, title = "Aplicaciones del portafolio", showGaps = true,
}: { pool?: Application[]; title?: string; showGaps?: boolean }) {
  const [f, setF] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("name");
  const [desc, setDesc] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setF((p) => ({ ...p, [k]: v })); setLimit(PAGE);
  };

  const filtered = useMemo(() => filterApps(pool, f), [pool, f]);
  const sorted = useMemo(() => {
    const dir = desc ? -1 : 1;
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "criticality": return dir * (CRIT_ORDER[a.criticality] - CRIT_ORDER[b.criticality]);
        case "platforms": return dir * (a.platforms.length - b.platforms.length);
        case "ags": return dir * (a.ags.length - b.ags.length);
        // Eje de costo: se ordena en su propia columna, nunca junto a criticidad.
        case "tickets": return dir * ((a.tickets_2024 ?? -1) - (b.tickets_2024 ?? -1));
        case "process": return dir * a.process.localeCompare(b.process);
        case "sector": return dir * a.sector.localeCompare(b.sector);
        default: return dir * a.name.localeCompare(b.name);
      }
    });
  }, [filtered, sort, desc]);

  const gaps = useMemo(() => computeGaps(pool), [pool]);
  const gapsF = useMemo(() => computeGaps(filtered), [filtered]);
  const active = (Object.keys(f) as (keyof Filters)[]).filter((k) => f[k] !== EMPTY_FILTERS[k]).length;

  const th = (key: SortKey, label: string) => (
    <th className="th">
      <button type="button"
        onClick={() => {
          if (sort === key) setDesc((d) => !d);
          else { setSort(key); setDesc(["tickets", "platforms", "ags"].includes(key)); }
        }}
        className="inline-flex items-center gap-1 hover:text-pep-900">
        {label}
        <span className={sort === key ? "text-pep-700" : "text-ink-300"}>
          {sort === key ? (desc ? "▼" : "▲") : "↕"}
        </span>
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      {showGaps ? (
        <section className="card card-pad border-ev-e2/40 bg-ev-e2/[0.05]">
          <SectionHeader kicker="Panel fijo · calculado desde los datos" title="Hueco declarado" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Sin plataforma" resolved={gaps.withoutPlatform} universe={gaps.universe} unitLabel="stack no resuelto" />
            <Metric label="Sin Assignment Group" resolved={gaps.withoutAg} universe={gaps.universe} unitLabel="no ruteables" />
            <Metric label="Sin DPM confirmado" resolved={gaps.withoutDpm} universe={gaps.universe} unitLabel="DPM en TBD" />
            <Metric label="Sin atribución completa" resolved={gaps.withoutAttribution} universe={gaps.universe} unitLabel="proceso o sector ausente" />
            <Metric label="Sin criticidad declarada" resolved={gaps.withoutCriticality} universe={gaps.universe} unitLabel="se muestran como No declarada" />
          </div>
          <div className="mt-3">
            <Note tone="warn">
              Ninguna de estas aplicaciones se filtra fuera de la tabla: aparecen etiquetadas y cuentan
              en el hueco. La criticidad no declarada no se imputa. Hoy son ruteables{" "}
              <InlineMetric resolved={gaps.routable} universe={gaps.universe} />; el resto no puede
              determinar el destino de un ticket.
            </Note>
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeader
          kicker={`${active} filtro${active === 1 ? "" : "s"} activo${active === 1 ? "" : "s"}`}
          title={title}
        >
          <div className="flex items-center gap-2">
            <span className="subtle">
              Mostrando <InlineMetric resolved={filtered.length} universe={pool.length} />
            </span>
            {active > 0 ? (
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
                  <option key={p.platform_id} value={p.name}>{p.name} ({p.blast_radius_direct})</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Estado de compuerta</span>
              <select className="input mt-1" value={f.gate} onChange={(e) => set("gate", e.target.value)}>
                <option value="">Cualquiera</option>
                <option value="routable">Ruteable</option>
                <option value="not-routable">No ruteable</option>
                <option value="owned">Con dueño</option>
                <option value="not-owned">Sin DPM confirmado</option>
                <option value="attributable">Atribuible</option>
                <option value="not-attributable">Sin atribución completa</option>
                <option value="platform">Con plataforma</option>
                <option value="not-platform">Sin plataforma</option>
              </select>
            </label>
          </div>
          <label className="mt-3 inline-flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={f.aiOnly} onChange={(e) => set("aiOnly", e.target.checked)}
              className="rounded border-ink-300 text-pep-700 focus:ring-pep-500" />
            Solo aplicaciones AI/ML
          </label>
        </div>

        {active > 0 ? (
          <div className="mb-3">
            <Note>
              En la selección actual:{" "}
              <InlineMetric resolved={gapsF.withoutAg} universe={gapsF.universe} /> sin AG ·{" "}
              <InlineMetric resolved={gapsF.withoutDpm} universe={gapsF.universe} /> con DPM en TBD.
            </Note>
          </div>
        ) : null}

        <div className="card overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-ink-200 bg-pep-50">
                <tr>
                  {th("name", "Aplicación")}
                  <th className="th">APM</th>
                  {th("process", "Proceso")}
                  {th("sector", "Sector")}
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
                    <td className="td max-w-[300px]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate"><AppLink appId={a.app_id} name={a.name} /></span>
                        {a.is_ai_ml ? <AiTag /> : null}
                      </div>
                    </td>
                    <td className="num td text-ink-500">{a.apm || <TbdValue value={null} />}</td>
                    <td className="td max-w-[160px] truncate"><TbdValue value={a.process} /></td>
                    <td className="td max-w-[150px] truncate"><TbdValue value={a.sector} /></td>
                    <td className="td"><CriticalityChip value={a.criticality} /></td>
                    <td className="td max-w-[160px] truncate"><TbdValue value={a.dpm} /></td>
                    <td className="num td">{a.platforms.length || <span className="text-ink-400">0</span>}</td>
                    <td className="td">
                      {a.ags.length > 0 ? <span className="num">{a.ags.length}</span> : <NotRoutableTag />}
                    </td>
                    {/* Sin semáforo: un solo color cualquiera que sea el volumen. */}
                    <td className="td"><SupportLoad value={a.tickets_2024} /></td>
                    <td className="td"><GateChips gates={a.gates} /></td>
                  </tr>
                ))}
                {sorted.length === 0 ? (
                  <tr><td colSpan={10} className="td py-8 text-center text-ink-500">
                    Ninguna aplicación cumple los filtros.
                  </td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="border-t border-ink-200 bg-pep-50 px-3 py-2 text-center">
            {limit < sorted.length ? (
              <button type="button" className="btn" onClick={() => setLimit((l) => l + PAGE * 2)}>
                Mostrar más — {limit} de {sorted.length} visibles
              </button>
            ) : (
              <span className="subtle num">{sorted.length} de {UNIVERSE} aplicaciones del universo</span>
            )}
          </div>
        </div>
        <p className="subtle mt-2">
          Carga de soporte es <span className="num">tickets_2024</span> y es eje de costo, no de riesgo:
          no se colorea ni se ordena junto a criticidad.
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
