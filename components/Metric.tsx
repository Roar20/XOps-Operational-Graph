import type { ReactNode } from "react";

/**
 * R2 — Toda cifra se muestra con su denominador.
 * Este componente es el unico camino permitido para presentar una proporcion:
 * exige `resolved` y `universe` y siempre imprime "X de Y (Z%)".
 */
export function Metric({
  label, resolved, universe, unitLabel = "aplicaciones", note, tone = "neutral", compact = false,
}: {
  label?: ReactNode;
  resolved: number;
  universe: number;
  unitLabel?: string;
  note?: ReactNode;
  tone?: "neutral" | "gap" | "good";
  compact?: boolean;
}) {
  const pct = universe > 0 ? (resolved / universe) * 100 : 0;
  const toneCls =
    tone === "gap" ? "text-ink-900" : tone === "good" ? "text-emerald-700" : "text-ink-900";
  return (
    <div>
      {label ? <div className="label">{label}</div> : null}
      <div className={`${compact ? "text-lg" : "text-2xl"} font-semibold leading-tight ${toneCls}`}>
        <span className="num">{resolved.toLocaleString("es-MX")}</span>
        <span className="text-ink-400 font-normal"> de </span>
        <span className="num text-ink-600 font-normal">{universe.toLocaleString("es-MX")}</span>
      </div>
      <div className="subtle num mt-0.5">
        {pct.toFixed(1)}% {unitLabel ? <span className="font-sans">· {unitLabel}</span> : null}
      </div>
      {note ? <div className="subtle mt-1">{note}</div> : null}
    </div>
  );
}

/** Version en linea de R2, para usar dentro de un parrafo. */
export function InlineMetric({ resolved, universe }: { resolved: number; universe: number }) {
  const pct = universe > 0 ? (resolved / universe) * 100 : 0;
  return (
    <span className="num whitespace-nowrap font-medium">
      {resolved.toLocaleString("es-MX")} de {universe.toLocaleString("es-MX")} ({pct.toFixed(1)}%)
    </span>
  );
}
