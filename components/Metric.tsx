import type { ReactNode } from "react";

/**
 * R3 · Ninguna metrica se muestra sin su cobertura declarada.
 * Este componente es el unico camino para publicar una proporcion: exige
 * `resolved` y `universe`, y siempre imprime "165 de 504 · 32.7%".
 * No existe forma de renderizar el porcentaje suelto.
 */
export function Metric({
  label, resolved, universe, unitLabel, note, compact = false, tone = "neutral",
}: {
  label?: ReactNode;
  resolved: number;
  universe: number;
  unitLabel?: string;
  note?: ReactNode;
  compact?: boolean;
  tone?: "neutral" | "gap" | "good";
}) {
  const pct = universe > 0 ? (resolved / universe) * 100 : 0;
  const tint = tone === "gap" ? "text-bad" : tone === "good" ? "text-good" : "text-pep-900";
  return (
    <div>
      {label ? <div className="label">{label}</div> : null}
      <div className={`${compact ? "text-lg" : "text-2xl"} font-semibold leading-tight ${tint}`}>
        <span className="num">{resolved.toLocaleString("es-MX")}</span>
        <span className="font-normal text-ink-400"> de </span>
        <span className="num font-normal text-ink-500">{universe.toLocaleString("es-MX")}</span>
      </div>
      <div className="subtle num mt-0.5">
        {pct.toFixed(1)}%{unitLabel ? <span className="font-sans"> · {unitLabel}</span> : null}
      </div>
      {note ? <div className="subtle mt-1">{note}</div> : null}
    </div>
  );
}

/** Version en linea de R3, para usar dentro de un parrafo. */
export function InlineMetric({ resolved, universe }: { resolved: number; universe: number }) {
  const pct = universe > 0 ? (resolved / universe) * 100 : 0;
  return (
    <span className="num whitespace-nowrap font-semibold">
      {resolved.toLocaleString("es-MX")} de {universe.toLocaleString("es-MX")} · {pct.toFixed(1)}%
    </span>
  );
}
