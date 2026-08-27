"use client";
import { useState } from "react";
import { meta } from "@/lib/data";

/**
 * R8 · Cada eslabon lleva su nivel de evidencia. E1 CMDB, E2 analisis
 * derivado, E3 hoja de calculo. Es un atributo del dato, no un disclaimer.
 */
const STYLE: Record<string, string> = {
  E1: "border-ev-e1/40 bg-ev-e1/10 text-ev-e1",
  E2: "border-ev-e2/40 bg-ev-e2/10 text-ev-e2",
  E3: "border-ev-e3/40 bg-ev-e3/10 text-ev-e3",
  "E2/E3": "border-ev-e3/40 bg-ev-e3/10 text-ev-e3",
};
export const AUTHORITY: Record<string, string> = {
  E1: "alta autoridad",
  E2: "autoridad media",
  E3: "baja autoridad",
  "E2/E3": "autoridad mixta",
};

export function EvidenceBadge({
  tier, showAuthority = false,
}: { tier: string; showAuthority?: boolean }) {
  const [open, setOpen] = useState(false);
  const desc = meta.evidence_tiers[tier] ?? AUTHORITY[tier] ?? tier;
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        title={`${tier} · ${desc}`}
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STYLE[tier] ?? STYLE.E3}`}
      >
        {tier}
        {showAuthority ? <span className="font-normal">· {AUTHORITY[tier]}</span> : null}
      </button>
      {open ? (
        <span className="absolute left-0 top-full z-30 mt-1 w-64 rounded border border-ink-200 bg-white p-2 text-xs font-normal text-ink-700 shadow-lg">
          <strong className="block text-ink-900">{tier} · {AUTHORITY[tier]}</strong>
          {desc}
        </span>
      ) : null}
    </span>
  );
}
