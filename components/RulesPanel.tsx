"use client";
import { useEffect, useState } from "react";
import { meta, quality, coverage } from "@/lib/data";
import { EvidenceBadge } from "./EvidenceBadge";

/** Panel "Cómo leer esto". Vive en el layout, por lo tanto es accesible
 *  desde las cinco pantallas. Muestra meta.rules y meta.evidence_tiers. */
export function RulesPanel() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn shrink-0">
        Cómo leer esto
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-pep-900/40" onClick={() => setOpen(false)}>
          <aside
            className="scroll-thin h-full w-full max-w-2xl overflow-y-auto bg-canvas shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-ink-200 bg-pep-900 px-6 py-4 text-white">
              <div>
                <h2 className="text-lg font-semibold">Cómo leer esto</h2>
                <p className="mt-0.5 text-xs text-pep-100">
                  El contrato del modelo. Corte {meta.as_of} · fuente {meta.source_file}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)}
                className="btn shrink-0 border-white/30 bg-white/10 text-white hover:bg-white/20">
                Cerrar
              </button>
            </header>

            <div className="space-y-6 px-6 py-5">
              <section>
                <h3 className="label mb-2">Alcance declarado</h3>
                <p className="text-sm leading-relaxed text-ink-700">{meta.scope_note}</p>
                <ul className="mt-2 space-y-1">
                  {meta.out_of_scope.map((s) => (
                    <li key={s} className="flex gap-2 text-sm text-ink-600">
                      <span className="shrink-0 text-ink-400">Fuera de v1:</span><span>{s}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="label mb-2">Reglas del modelo</h3>
                <ol className="space-y-2.5">
                  {meta.rules.map((r) => (
                    <li key={r.id} className="card card-pad">
                      <div className="flex items-baseline gap-2">
                        <span className="num rounded bg-pep-900 px-1.5 py-0.5 text-[11px] font-bold text-white">{r.id}</span>
                        <h4 className="text-sm font-semibold text-ink-900">{r.title}</h4>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{r.statement}</p>
                      {r.consequence ? (
                        <p className="mt-1.5 border-l-2 border-pep-500/40 pl-2 text-xs leading-relaxed text-ink-500">
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
                  {Object.entries(meta.evidence_tiers).map(([t, d]) => (
                    <li key={t} className="flex items-start gap-2 text-sm text-ink-700">
                      <EvidenceBadge tier={t} /><span>{d}</span>
                    </li>
                  ))}
                </ul>
                <p className="subtle mt-2">
                  Cobertura por eslabón:{" "}
                  {coverage.map((c) => `${c.id} ${c.evidence_tier}`).join(" · ")}
                </p>
              </section>

              <section>
                <h3 className="label mb-2">Escala de criticidad</h3>
                <ul className="space-y-1.5">
                  {Object.entries(meta.criticality_scale).map(([k, v]) => (
                    <li key={k} className="text-sm text-ink-700">
                      {k === "note"
                        ? <span className="text-ink-500">{v}</span>
                        : <><span className="num font-semibold text-ink-900">{k}</span> — {v}</>}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="label mb-2">Derivación declarada</h3>
                <p className="text-sm leading-relaxed text-ink-700">{meta.derivation_warning}</p>
              </section>

              <section>
                <h3 className="label mb-2">Instrumento de calidad</h3>
                <p className="text-sm leading-relaxed text-ink-700">{quality.meta.instrument_warning}</p>
              </section>

              <section>
                <h3 className="label mb-2">Hallazgos del propio catálogo</h3>
                <ul className="space-y-2">
                  {meta.data_quality_notes.map((n) => (
                    <li key={n.id} className="card card-pad">
                      <div className="flex items-baseline gap-2">
                        <span className="num rounded bg-ev-e2 px-1.5 py-0.5 text-[11px] font-bold text-white">{n.id}</span>
                        <h4 className="text-sm font-semibold text-ink-900">{n.title}</h4>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-ink-600">{n.detail}</p>
                      {n.items?.length ? (
                        <ul className="mt-1.5 space-y-0.5">
                          {n.items.map((it) => (
                            <li key={it.ag_key} className="num text-[11px] text-ink-500">
                              {it.names.map((x) => `“${x}”`).join("  ≡  ")}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
