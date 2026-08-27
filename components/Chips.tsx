import Link from "next/link";
import type { Criticality, Gates } from "@/types";
import { isTbd } from "@/lib/data";

/** Anything unconfirmed is declared as TBD, never blank and never a dash. */
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
  "C-": { cls: "border-ink-300 bg-ink-100 text-ink-500", label: "Not declared" },
};

/** 324 of 504 applications have no declared criticality. None is imputed. */
export function CriticalityChip({ value, withLabel = false }: { value: Criticality; withLabel?: boolean }) {
  const c = CRIT[value] ?? CRIT["C-"];
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold ${c.cls}`}>
      {withLabel ? c.label : value === "C-" ? "Not declared" : value}
    </span>
  );
}

const GATES: [keyof Gates, string, string][] = [
  ["attributable", "A", "Attributable · process and sector"],
  ["routable", "R", "Routable · has an Assignment Group"],
  ["owned", "D", "Owned · DPM without TBD"],
  ["platform_known", "P", "Platform identified"],
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
      Not routable
    </span>
  );
}

/**
 * R5 · Ticket volume is a cost axis, never a risk axis.
 * One neutral colour whatever the volume: no traffic-light scale.
 */
export function SupportLoad({ value, showLabel = false }: { value: number | null; showLabel?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 text-ink-700">
      <span className="num text-sm">{value == null ? "—" : value.toLocaleString("en-US")}</span>
      {showLabel ? <span className="text-[10px] uppercase tracking-wide text-ink-400">support load</span> : null}
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

/** Quality is measured per AG, not per application: labelled as an approximation. */
export function ApproxTag({ children = "approximation via AGs" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-ev-e2/40 bg-ev-e2/10 px-1.5 py-0.5 text-[10px] font-semibold text-ev-e2">
      {children}
    </span>
  );
}
