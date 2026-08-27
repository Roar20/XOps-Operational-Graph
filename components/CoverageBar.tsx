import type { CoverageLink } from "@/lib/types";
import { EvidenceBadge } from "./EvidenceBadge";
import { Metric } from "./Metric";

/**
 * Un eslabon de cobertura. Muestra resolved/universe, porcentaje, el owner del
 * desbloqueo y el nivel de evidencia (R2 + R5). Cuando el eslabon mezcla origenes
 * de distinta autoridad, los desglosa en vez de promediarlos (caso L1).
 */
export function CoverageCard({ link }: { link: CoverageLink }) {
  const pct = link.universe > 0 ? (link.resolved / link.universe) * 100 : 0;
  const lowAuthority = link.evidence_tier === "E3";

  return (
    <div className="card card-pad flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="num rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-bold text-ink-700">{link.id}</span>
            <EvidenceBadge tier={link.evidence_tier} showAuthority />
          </div>
          <h3 className="mt-1.5 truncate text-sm font-semibold text-ink-900">{link.link}</h3>
        </div>
      </div>

      <Metric resolved={link.resolved} universe={link.universe} unitLabel="resueltas" compact />

      <div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100" role="img"
             aria-label={`${link.resolved} de ${link.universe} resueltas, ${pct.toFixed(1)} por ciento`}>
          <div
            className={`h-full rounded-full ${lowAuthority ? "bg-rose-400" : "bg-ink-700"}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <div className="subtle num mt-1">Hueco: {link.gap.toLocaleString("es-MX")} aplicaciones</div>
      </div>

      {link.breakdown?.length ? (
        <div className="rounded-md border border-ink-200 bg-ink-50 p-2">
          <div className="label mb-1">Origenes de distinta autoridad</div>
          <ul className="space-y-1">
            {link.breakdown.map((b) => (
              <li key={b.evidence_tier} className="flex items-start gap-1.5 text-[11px] text-ink-600">
                <EvidenceBadge tier={b.evidence_tier} />
                <span>
                  <span className="num font-semibold text-ink-900">{b.resolved}</span> · {b.source}
                </span>
              </li>
            ))}
          </ul>
          {/* R1 aplicada a la cobertura: los origenes tampoco se suman. */}
          <p className="mt-1.5 text-[11px] leading-snug text-ink-500">
            Los origenes se traslapan, por lo tanto la union es{" "}
            <span className="num font-semibold">{link.resolved}</span>, no{" "}
            <span className="num">{link.breakdown.reduce((s, b) => s + b.resolved, 0)}</span>.
          </p>
        </div>
      ) : null}

      <dl className="mt-auto space-y-1 border-t border-ink-100 pt-2 text-[11px]">
        <div className="flex gap-1.5">
          <dt className="shrink-0 text-ink-400">Fuente</dt>
          <dd className="text-ink-600">{link.source}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="shrink-0 text-ink-400">Desbloquea</dt>
          <dd className="font-medium text-ink-800">{link.owner}</dd>
        </div>
      </dl>
    </div>
  );
}
