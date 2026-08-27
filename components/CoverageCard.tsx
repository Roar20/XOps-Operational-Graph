import type { CoverageLink } from "@/types";
import { EvidenceBadge } from "./EvidenceBadge";
import { Metric } from "./Metric";

/** Un eslabón: resuelto sobre universo, porcentaje, owner del desbloqueo y
 *  nivel de evidencia. Cuando mezcla autoridades, las desglosa. */
export function CoverageCard({ link }: { link: CoverageLink }) {
  const pct = link.universe > 0 ? (link.resolved / link.universe) * 100 : 0;
  const low = link.evidence_tier.includes("E3");
  return (
    <div className="card card-pad flex flex-col gap-3">
      <div className="flex items-start gap-1.5">
        <span className="num rounded bg-pep-900 px-1.5 py-0.5 text-[11px] font-bold text-white">{link.id}</span>
        <EvidenceBadge tier={link.evidence_tier} showAuthority />
      </div>
      <h3 className="text-sm font-semibold text-ink-900">{link.link}</h3>

      <Metric resolved={link.resolved} universe={link.universe} unitLabel="resueltas" compact />

      <div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100"
             role="img"
             aria-label={`${link.resolved} de ${link.universe} resueltas, ${pct.toFixed(1)} por ciento`}>
          <div className={`h-full rounded-full ${low ? "bg-ev-e3" : "bg-pep-700"}`}
               style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="subtle num mt-1">Hueco: {link.gap.toLocaleString("es-MX")} aplicaciones</div>
      </div>

      {link.breakdown?.length ? (
        <div className="rounded border border-ink-200 bg-pep-50 p-2">
          <div className="label mb-1">Dos orígenes de distinta autoridad</div>
          <ul className="space-y-1">
            {link.breakdown.map((b) => (
              <li key={b.evidence_tier} className="flex items-start gap-1.5 text-[11px] text-ink-600">
                <EvidenceBadge tier={b.evidence_tier} />
                <span><span className="num font-semibold text-ink-900">{b.resolved}</span> · {b.source}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] leading-snug text-ink-500">
            No se presentan como equivalentes: la porción E3 se derivó de texto libre y admite
            falsos positivos.
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
          <dd className="font-medium text-pep-700">{link.owner}</dd>
        </div>
      </dl>
    </div>
  );
}
