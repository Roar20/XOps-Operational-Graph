import type { ImpactLevel } from "@/lib/data";

/* Impacto de negocio declarado. Cuatro niveles y un quinto estado explicito
   para lo no declarado, que NO es Low: 404 de 504 aplicaciones no traen nivel
   y confundir ausencia con bajo impacto es el error que esta escala evita. */
const STYLE: Record<string, string> = {
  Critical: "border-bad/50 bg-bad/12 text-bad",
  High: "border-bad/35 bg-bad/[0.07] text-bad",
  Medium: "border-ev-e2/40 bg-ev-e2/10 text-ev-e2",
  Low: "border-pep-500/40 bg-pep-50 text-pep-700",
  none: "border-ink-300 bg-ink-100 text-ink-500",
};

export function ImpactChip({ level }: { level: ImpactLevel | null }) {
  const key = level ?? "none";
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold ${STYLE[key]}`}>
      {level ? `${level} impact` : "Impact not declared"}
    </span>
  );
}
