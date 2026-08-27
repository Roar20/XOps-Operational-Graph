import type { ReactNode } from "react";

export function SectionHeader({ title, kicker, children }: { title: string; kicker?: string; children?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        {kicker ? <div className="label">{kicker}</div> : null}
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

/** Nota de lectura. Se usa para declarar lo no resuelto en el lugar donde importa (R4). */
export function ReadingNote({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" }) {
  const cls = tone === "warn"
    ? "border-amber-300 bg-amber-50 text-amber-900"
    : "border-ink-200 bg-ink-50 text-ink-600";
  return (
    <p className={`rounded-md border px-3 py-2 text-xs leading-relaxed ${cls}`}>{children}</p>
  );
}
