import type { ReactNode } from "react";

/**
 * R3 · No metric is shown without its declared coverage.
 * This component is the only way to publish a proportion: it requires both
 * `resolved` and `universe`, and always prints "165 of 504 · 32.7%".
 * There is no code path that renders a bare percentage.
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
        <span className="num">{resolved.toLocaleString("en-US")}</span>
        <span className="font-normal text-ink-400"> of </span>
        <span className="num font-normal text-ink-500">{universe.toLocaleString("en-US")}</span>
      </div>
      <div className="subtle num mt-0.5">
        {pct.toFixed(1)}%{unitLabel ? <span className="font-sans"> · {unitLabel}</span> : null}
      </div>
      {note ? <div className="subtle mt-1">{note}</div> : null}
    </div>
  );
}

/** Inline version of R3, for use inside a sentence. */
export function InlineMetric({ resolved, universe }: { resolved: number; universe: number }) {
  const pct = universe > 0 ? (resolved / universe) * 100 : 0;
  return (
    <span className="num whitespace-nowrap font-semibold">
      {resolved.toLocaleString("en-US")} of {universe.toLocaleString("en-US")} · {pct.toFixed(1)}%
    </span>
  );
}
