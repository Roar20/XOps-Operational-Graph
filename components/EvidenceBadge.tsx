"use client";
import { useState } from "react";
import type { EvidenceTier } from "@/lib/types";
import { meta } from "@/lib/data";

/**
 * R5 — Cada dato lleva su nivel de evidencia.
 * E3 (hoja de calculo, baja autoridad) se marca de forma visible y consistente.
 * No es un disclaimer al pie: es un atributo del dato.
 */
const STYLE: Record<EvidenceTier, string> = {
  E1: "border-emerald-300 bg-emerald-50 text-emerald-800",
  E2: "border-amber-300 bg-amber-50 text-amber-800",
  E3: "border-rose-300 bg-rose-50 text-rose-800",
};
const AUTHORITY: Record<EvidenceTier, string> = {
  E1: "alta autoridad",
  E2: "autoridad media",
  E3: "baja autoridad",
};

export function EvidenceBadge({ tier, showAuthority = false }: { tier: EvidenceTier; showAuthority?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        title={`${tier} — ${meta.evidence_tiers[tier]}`}
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STYLE[tier]}`}
      >
        {tier}
        {showAuthority ? <span className="font-normal">· {AUTHORITY[tier]}</span> : null}
      </button>
      {open ? (
        <span className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-ink-200 bg-white p-2 text-xs font-normal text-ink-700 shadow-lg">
          <strong className="block text-ink-900">{tier} — {AUTHORITY[tier]}</strong>
          {meta.evidence_tiers[tier]}
        </span>
      ) : null}
    </span>
  );
}
