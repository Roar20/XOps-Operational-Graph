import type { BaselineMetric } from "@/lib/types";

/**
 * Criterio 9 — El color del delta responde a `direccion_deseada`, no al signo.
 * Una caida de poor_critical_rate se pinta como mejora.
 * Esta es la UNICA funcion que decide el color de un delta en la aplicacion.
 */
export function deltaTone(m: Pick<BaselineMetric, "delta" | "direccion_deseada">): "mejora" | "retroceso" | "sin cambio" {
  if (Math.abs(m.delta) < 0.05) return "sin cambio";
  const movingUp = m.delta > 0;
  const wantsUp = m.direccion_deseada === "up";
  return movingUp === wantsUp ? "mejora" : "retroceso";
}

const TONE_CLS = {
  mejora: "border-emerald-300 bg-emerald-50 text-emerald-800",
  retroceso: "border-rose-300 bg-rose-50 text-rose-800",
  "sin cambio": "border-ink-300 bg-ink-100 text-ink-600",
} as const;

// El chip de juicio NO usa flecha: la flecha describe el movimiento y ya vive en
// la insignia del delta. Mezclarlas produce un "▼ -5.2 pp" junto a un "▲ mejora".
const MARK = { mejora: "✓", retroceso: "✕", "sin cambio": "—" } as const;

export function DeltaCard({ m }: { m: BaselineMetric }) {
  const tone = deltaTone(m);
  const sign = m.delta > 0 ? "+" : "";
  const wanted = m.direccion_deseada === "up" ? "mejora a la alza" : "mejora a la baja";

  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-900">{m.label}</h3>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold ${TONE_CLS[tone]}`}
          title={`Delta ${sign}${m.delta} ${m.unit}; direccion deseada: ${wanted}. El color refleja la direccion deseada, no el signo.`}
        >
          <span aria-hidden>{m.delta > 0 ? "▲" : m.delta < 0 ? "▼" : "→"}</span>
          <span className="num">{sign}{m.delta.toFixed(1)} {m.unit}</span>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="label">Base</div>
          <div className="num text-lg font-semibold text-ink-500">{m.baseline.toFixed(1)}</div>
        </div>
        <div>
          <div className="label">Actual</div>
          <div className="num text-lg font-semibold text-ink-900">{m.current.toFixed(1)}</div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 border-t border-ink-100 pt-2">
        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${TONE_CLS[tone]}`}>
          {MARK[tone]} {tone}
        </span>
        <span className="text-[11px] text-ink-500">{wanted}</span>
      </div>
    </div>
  );
}
