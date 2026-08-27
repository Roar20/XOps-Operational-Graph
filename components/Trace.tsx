"use client";
import { useEffect, useState } from "react";
import { measureById, liveFor, meta, AS_OF } from "@/lib/data";
import { EvidenceBadge } from "./EvidenceBadge";
import { InlineMetric } from "./Metric";

/**
 * Trazabilidad de una cifra publicada. El boton lleva el id de la metrica y
 * abre su ficha completa: formula de negocio, denominador declarado, nivel de
 * evidencia, estado y fuente. Muestra ademas el valor que ESTA aplicacion
 * calcula junto al que la hoja escribio, y marca la divergencia cuando existe:
 * reconciliarlos en silencio borraria justo la trazabilidad que la ficha da.
 */
const STATUS_STYLE: Record<string, string> = {
  Provisional: "border-ev-e2/40 bg-ev-e2/10 text-ev-e2",
  Blocked: "border-bad/40 bg-bad/10 text-bad",
  Certified: "border-good/40 bg-good/10 text-good",
};

export function Trace({ measure, label }: { measure: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const m = measureById.get(measure);
  const live = liveFor(measure);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!m) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`How ${m.name} is computed, where it comes from and what it does not cover`}
        aria-label={`Traceability for ${m.name}`}
        className="inline-flex items-center gap-1 rounded border border-ink-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink-600 transition hover:border-pep-500 hover:text-pep-700"
      >
        <span aria-hidden>⌕</span>
        <span className="num">{m.measure_id}</span>
        {label ? <span className="font-normal">{label}</span> : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-pep-900/40 p-0 sm:items-center sm:p-6"
             onClick={() => setOpen(false)}>
          <div className="scroll-thin max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-t border border-ink-200 bg-white shadow-2xl sm:rounded"
               onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
               aria-label={`Traceability for ${m.name}`}>
            <header className="sticky top-0 flex items-start justify-between gap-4 border-b border-ink-200 bg-pep-900 px-5 py-3.5 text-white">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-pep-100">
                  Where this number comes from
                </div>
                <h2 className="text-base font-semibold">
                  <span className="num">{m.measure_id}</span> · {m.name}
                </h2>
              </div>
              <button type="button" onClick={() => setOpen(false)}
                      className="btn shrink-0 border-white/30 bg-white/10 text-white hover:bg-white/20">
                Close
              </button>
            </header>

            <div className="space-y-4 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[m.status] ?? STATUS_STYLE.Provisional}`}>
                  {m.status}
                </span>
                <EvidenceBadge tier={m.evidence_tier} showAuthority />
                <span className="subtle">{m.layer} · per {m.grain.toLowerCase()}</span>
              </div>

              {m.status === "Blocked" ? (
                <p className="rounded border border-bad/40 bg-bad/[0.06] px-3 py-2 text-xs leading-relaxed text-ink-900">
                  This measure is <strong>blocked</strong>: the model cannot compute it yet. It is published
                  as blocked rather than estimated, so nothing downstream quietly depends on a guess.
                </p>
              ) : (
                <p className="rounded border border-ev-e2/40 bg-ev-e2/[0.07] px-3 py-2 text-xs leading-relaxed text-ink-900">
                  <strong>Provisional</strong> means computed and reproducible, but not certified.
                  Certification is an act of governance, not of the model, and nothing here claims it.
                </p>
              )}

              <Field label="What it counts (business formula)">{m.formula}</Field>
              <Field label="Declared denominator">{m.denominator}</Field>
              {m.coverage ? <Field label="Coverage stated on the sheet">{m.coverage}</Field> : null}
              <Field label="Note from the source sheet">{m.note}</Field>

              {live ? (
                <div className="rounded border border-ink-200 bg-pep-50 p-3">
                  <div className="label mb-1.5">Value computed here, at cut-off {AS_OF}</div>
                  <div className="text-sm text-ink-900">
                    {live.label}: <InlineMetric resolved={live.resolved} universe={live.universe} />
                  </div>
                  {live.sheetClaim ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-600">
                      The sheet records <span className="num font-medium">{live.sheetClaim}</span> for this
                      measure. Where that disagrees with the figure above, the figure above is the one this
                      interface computes from the rows, and the sheet&rsquo;s value is kept visible rather than
                      overwritten.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="border-t border-ink-100 pt-3">
                <div className="label mb-1">Source</div>
                <p className="text-xs leading-relaxed text-ink-600">
                  Sheet <span className="num">{m.source_sheet}</span> of{" "}
                  <span className="num">{meta.source_file}</span>, projected by{" "}
                  <span className="num">scripts/build_data.py</span>, which fails the build if any of its
                  invariants stops holding. Data cut-off {meta.as_of}.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <p className="mt-0.5 text-sm leading-relaxed text-ink-800">{children}</p>
    </div>
  );
}
