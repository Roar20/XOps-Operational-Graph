import Link from "next/link";
import type { Criticality, Gates } from "@/types";
import { isTbd } from "@/lib/data";

/** Lo no confirmado se declara como TBD, nunca en blanco ni como guion. */
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

const CRIT: Record<Criticality, { cls: string; label: string }> = {
  C1: { cls: "border-bad/40 bg-bad/10 text-bad", label: "C1 · most critical" },
  C2: { cls: "border-ev-e2/40 bg-ev-e2/10 text-ev-e2", label: "C2 · somewhat critical" },
  C3: { cls: "border-pep-500/40 bg-pep-50 text-pep-700", label: "C3 · less critical" },
  "C-": { cls: "border-ink-300 bg-ink-100 text-ink-500", label: "No declarada" },
};

/** 324 de 504 aplicaciones no tienen criticidad declarada. No se imputan. */
export function CriticalityChip({ value, withLabel = false }: { value: Criticality; withLabel?: boolean }) {
  const c = CRIT[value] ?? CRIT["C-"];
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold ${c.cls}`}>
      {withLabel ? c.label : value === "C-" ? "No declarada" : value}
    </span>
  );
}

const GATES: [keyof Gates, string, string][] = [
  ["attributable", "A", "Atribuible · proceso y sector"],
  ["routable", "R", "Ruteable · con Assignment Group"],
  ["owned", "D", "Con dueño · DPM sin TBD"],
  ["platform_known", "P", "Con plataforma identificada"],
];

/** Una compuerta cerrada se muestra, nunca filtra la fila fuera de la lista. */
export function GateChips({ gates }: { gates: Gates }) {
  return (
    <span className="inline-flex gap-1">
      {GATES.map(([k, short, long]) => (
        <span
          key={k}
          title={gates[k] ? long : `No cumple: ${long}`}
          className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
            gates[k]
              ? "bg-pep-100 text-pep-900 ring-1 ring-pep-500/50"
              : "bg-ink-100 text-ink-400 ring-1 ring-ink-200"
          }`}
        >
          {short}
        </span>
      ))}
    </span>
  );
}

export function NotRoutableTag() {
  return (
    <span className="inline-flex items-center rounded border border-ink-300 bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-ink-600">
      No ruteable
    </span>
  );
}

/**
 * R5 · El volumen de tickets es eje de costo, nunca eje de riesgo.
 * Un solo color neutro cualquiera que sea el volumen: sin semaforo.
 */
export function SupportLoad({ value, showLabel = false }: { value: number | null; showLabel?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 text-ink-700">
      <span className="num text-sm">{value == null ? "—" : value.toLocaleString("es-MX")}</span>
      {showLabel ? <span className="text-[10px] uppercase tracking-wide text-ink-400">carga de soporte</span> : null}
    </span>
  );
}

export function AppLink({ appId, name }: { appId: string; name: string }) {
  return (
    <Link href={`/app/${appId}`}
      className="font-medium text-pep-700 underline decoration-pep-500/40 underline-offset-2 hover:decoration-pep-700">
      {name}
    </Link>
  );
}

export function AiTag() {
  return (
    <span className="inline-flex items-center rounded border border-pep-500/40 bg-pep-50 px-1.5 py-0.5 text-[10px] font-semibold text-pep-700">
      AI/ML
    </span>
  );
}

/** La calidad se mide por AG, no por aplicacion: se etiqueta como aproximacion. */
export function ApproxTag({ children = "aproximación vía AGs" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-ev-e2/40 bg-ev-e2/10 px-1.5 py-0.5 text-[10px] font-semibold text-ev-e2">
      {children}
    </span>
  );
}
