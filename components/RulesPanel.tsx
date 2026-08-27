"use client";
import { useEffect, useState } from "react";
import { meta } from "@/lib/data";
import { EvidenceBadge } from "./EvidenceBadge";
import type { EvidenceTier } from "@/lib/types";

/**
 * Criterio 5 — El panel de reglas del modelo es accesible desde toda la app.
 * Vive en el layout, por lo tanto esta disponible en las cinco pantallas.
 */
export function RulesPanel() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn">
        <span aria-hidden>?</span> Como leer esto
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink-950/40" onClick={() => setOpen(false)}>
          <aside
            className="scroll-thin h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-ink-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">Como leer esto</h2>
                <p className="subtle mt-0.5">
                  Las reglas del modelo son el contrato de esta aplicacion, no decoracion.
                  Corte de datos {meta.as_of}.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="btn shrink-0">Cerrar</button>
            </header>

            <div className="space-y-6 px-6 py-5">
              <section>
                <h3 className="label mb-2">Alcance declarado</h3>
                <p className="text-sm leading-relaxed text-ink-700">{meta.scope_note}</p>
                {meta.out_of_scope?.length ? (
                  <ul className="mt-2 space-y-1">
                    {meta.out_of_scope.map((s) => (
                      <li key={s} className="flex gap-2 text-sm text-ink-600">
                        <span className="text-ink-400">Fuera de v1:</span><span>{s}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>

              <section>
                <h3 className="label mb-2">Reglas del modelo</h3>
                <ol className="space-y-3">
                  {meta.rules.map((r) => (
                    <li key={r.id} className="card card-pad">
                      <div className="flex items-baseline gap-2">
                        <span className="num rounded bg-ink-900 px-1.5 py-0.5 text-[11px] font-bold text-white">{r.id}</span>
                        <h4 className="text-sm font-semibold text-ink-900">{r.title}</h4>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{r.statement}</p>
                      {r.consequence ? (
                        <p className="mt-1.5 border-l-2 border-ink-200 pl-2 text-xs leading-relaxed text-ink-500">
                          {r.consequence}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>

              <section>
                <h3 className="label mb-2">Niveles de evidencia</h3>
                <ul className="space-y-2">
                  {(Object.keys(meta.evidence_tiers) as EvidenceTier[]).map((t) => (
                    <li key={t} className="flex items-start gap-2 text-sm text-ink-700">
                      <EvidenceBadge tier={t} />
                      <span>{meta.evidence_tiers[t]}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="label mb-2">Escala de criticidad</h3>
                <ul className="space-y-1.5">
                  {Object.entries(meta.criticality_scale).map(([k, v]) => (
                    <li key={k} className="text-sm text-ink-700">
                      <span className="num font-semibold text-ink-900">{k}</span> — {v}
                    </li>
                  ))}
                </ul>
              </section>

              {meta.data_provenance ? (
                <section className="rounded-md border border-amber-300 bg-amber-50 p-3">
                  <h3 className="label mb-1 text-amber-800">Procedencia de los datos</h3>
                  <p className="text-xs leading-relaxed text-amber-900">{meta.data_provenance}</p>
                </section>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
