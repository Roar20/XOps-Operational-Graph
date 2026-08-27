import type { ReactNode } from "react";

export function SectionHeader({ title, kicker, children }: {
  title: string; kicker?: string; children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        {kicker ? <div className="label">{kicker}</div> : null}
        <h2 className="text-lg font-semibold tracking-tight text-pep-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

/** Nota de lectura: declara lo no resuelto en el lugar donde importa. */
export function Note({ children, tone = "neutral" }: {
  children: ReactNode; tone?: "neutral" | "warn";
}) {
  const cls = tone === "warn"
    ? "border-ev-e2/40 bg-ev-e2/[0.07] text-ink-900"
    : "border-ink-200 bg-white text-ink-700";
  return <p className={`rounded border px-3 py-2 text-xs leading-relaxed ${cls}`}>{children}</p>;
}

/**
 * R3 · Una tabla de tasas declara su denominador una vez, en el caption, en
 * lugar de repetirlo en cada celda. Sin caption, un "34.5%" en una celda seria
 * un porcentaje suelto; con el, la columna que lo divide queda nombrada.
 */
export function TableCaption({ children }: { children: ReactNode }) {
  return (
    <caption className="caption-top pb-2 text-left text-xs leading-relaxed text-ink-500">
      {children}
    </caption>
  );
}
