import type { Direction } from "@/types";

/**
 * The delta colour follows the DESIRED DIRECTION, never the sign.
 * poor_critical_rate and reopen_rate improve downwards, so a negative delta on
 * them is painted as an improvement. This is the only function in the app that
 * decides that colour.
 */
export function deltaTone(value: number, direction: Direction): "improving" | "regressing" | "flat" {
  if (Math.abs(value) < 0.05) return "flat";
  return (value > 0) === (direction === "up_is_good") ? "improving" : "regressing";
}

const TONE = {
  improving: "border-good/40 bg-good/10 text-good",
  regressing: "border-bad/40 bg-bad/10 text-bad",
  flat: "border-ink-300 bg-ink-100 text-ink-500",
} as const;

const MARK = { improving: "✓", regressing: "✕", flat: "—" } as const;

export function Delta({
  value, direction, unit = "pp",
}: { value: number; direction: Direction; unit?: string }) {
  const tone = deltaTone(value, direction);
  const wanted = direction === "up_is_good" ? "higher is better" : "lower is better";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold ${TONE[tone]}`}
      title={`${value > 0 ? "+" : ""}${value} ${unit} · ${wanted}. The colour reflects the desired direction, not the sign.`}
    >
      <span aria-hidden>{value > 0 ? "▲" : value < 0 ? "▼" : "→"}</span>
      <span className="num">{value > 0 ? "+" : ""}{value.toFixed(1)} {unit}</span>
      <span className="font-normal opacity-80">{MARK[tone]} {tone}</span>
    </span>
  );
}
