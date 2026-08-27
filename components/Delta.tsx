import type { Direction } from "@/types";

/**
 * El color del delta responde a la DIRECCION DESEADA, nunca al signo.
 * poor_critical_rate y reopen_rate mejoran a la baja, por lo tanto un delta
 * negativo en ellas se pinta como mejora. Esta es la unica funcion de la
 * aplicacion que decide ese color.
 */
export function deltaTone(value: number, direction: Direction): "mejora" | "retroceso" | "sin cambio" {
  if (Math.abs(value) < 0.05) return "sin cambio";
  return (value > 0) === (direction === "up_is_good") ? "mejora" : "retroceso";
}

const TONE = {
  mejora: "border-good/40 bg-good/10 text-good",
  retroceso: "border-bad/40 bg-bad/10 text-bad",
  "sin cambio": "border-ink-300 bg-ink-100 text-ink-500",
} as const;

const MARK = { mejora: "✓", retroceso: "✕", "sin cambio": "—" } as const;

export function Delta({
  value, direction, unit = "pp",
}: { value: number; direction: Direction; unit?: string }) {
  const tone = deltaTone(value, direction);
  const wanted = direction === "up_is_good" ? "mejora a la alza" : "mejora a la baja";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold ${TONE[tone]}`}
      title={`${value > 0 ? "+" : ""}${value} ${unit} · ${wanted}. El color refleja la dirección deseada, no el signo.`}
    >
      <span aria-hidden>{value > 0 ? "▲" : value < 0 ? "▼" : "→"}</span>
      <span className="num">{value > 0 ? "+" : ""}{value.toFixed(1)} {unit}</span>
      <span className="font-normal opacity-80">{MARK[tone]} {tone}</span>
    </span>
  );
}
