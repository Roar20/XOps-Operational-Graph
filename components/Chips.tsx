import Link from "next/link";
import type { Criticality, Gates } from "@/lib/types";
import { isTbd } from "@/lib/data";

/** R4 — un valor no confirmado se muestra como TBD, nunca en blanco. */
export function TbdValue({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  if (isTbd(value)) {
    return (
      <span className={`inline-flex items-center rounded border border-ink-300 bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold text-ink-500 ${className}`}>
        TBD
      </span>
    );
  }
  return <span className={className}>{value}</span>;
}

const CRIT_STYLE: Record<Criticality, string> = {
  C1: "border-rose-300 bg-rose-50 text-rose-800",
  C2: "border-amber-300 bg-amber-50 text-amber-800",
  C3: "border-sky-300 bg-sky-50 text-sky-800",
  "C-": "border-ink-300 bg-ink-100 text-ink-500",
};
const CRIT_LABEL: Record<Criticality, string> = {
  C1: "C1 · critica", C2: "C2 · alta", C3: "C3 · media", "C-": "C- · sin declarar",
};

export function CriticalityChip({ value, withLabel = false }: { value: Criticality; withLabel?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold ${CRIT_STYLE[value]}`}>
      {withLabel ? CRIT_LABEL[value] : value}
    </span>
  );
}

/** Las tres compuertas del modelo. Una compuerta cerrada se muestra, no se filtra (R4). */
export function GateChips({ gates }: { gates: Gates }) {
  const items: [keyof Gates, string, string][] = [
    ["attributable", "A", "Atribuible"],
    ["routable", "R", "Ruteable"],
    ["owned", "D", "Con dueno"],
  ];
  return (
    <span className="inline-flex gap-1">
      {items.map(([k, short, long]) => (
        <span
          key={k}
          title={gates[k] ? long : `No ${long.toLowerCase()}`}
          className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
            gates[k]
              ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300"
              : "bg-ink-100 text-ink-400 ring-1 ring-ink-200"
          }`}
        >
          {short}
        </span>
      ))}
    </span>
  );
}

/** R4 — etiqueta explicita para la aplicacion que no puede rutear un ticket. */
export function NotRoutableTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-ink-300 bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-ink-600">
      No ruteable
    </span>
  );
}

/**
 * R3 — Los tickets son eje de costo, no senal de riesgo.
 * Siempre etiquetado como Carga de soporte y SIN semaforo: un solo color neutro,
 * cualquiera que sea el volumen.
 */
export function SupportLoad({ value, showLabel = true }: { value: number | null; showLabel?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 text-ink-700">
      <span className="num text-sm">{value == null ? "—" : value.toLocaleString("es-MX")}</span>
      {showLabel ? <span className="text-[10px] uppercase tracking-wide text-ink-400">carga de soporte</span> : null}
    </span>
  );
}

export function AppLink({ appId, name }: { appId: string; name: string }) {
  return (
    <Link href={`/app/${appId}`} className="font-medium text-ink-900 underline decoration-ink-300 underline-offset-2 hover:decoration-ink-900">
      {name}
    </Link>
  );
}

export function AiTag() {
  return (
    <span className="inline-flex items-center rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
      AI/ML
    </span>
  );
}
