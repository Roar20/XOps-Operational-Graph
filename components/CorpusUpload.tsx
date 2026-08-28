"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { IngestProgress, Scope } from "@/lib/qn/types";
import { useCorpus, scopeLabel, fmt } from "@/lib/qn/corpus";
import { SectionHeader } from "./SectionHeader";

/**
 * Seccion de carga. El libro es la fuente de verdad: se valida, se clasifica el
 * alcance hoja por hoja y se indexa, todo en el navegador.
 */
export function CorpusUpload() {
  const { snapshot, ready, reload, clear } = useCorpus();
  const [prog, setProg] = useState<IngestProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const worker = useRef<Worker | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const start = useCallback((file: File) => {
    setError(null);
    setProg({ phase: "reading", pct: 0 });
    worker.current?.terminate();
    const w = new Worker(new URL("../lib/qn/ingest.worker.ts", import.meta.url));
    worker.current = w;
    w.onmessage = (e: MessageEvent<IngestProgress>) => {
      setProg(e.data);
      if (e.data.phase === "done") { void reload(); w.terminate(); }
      if (e.data.phase === "error") { setError(e.data.message); w.terminate(); }
    };
    w.onerror = (ev) => setError(ev.message || "The worker failed while reading the workbook.");
    w.postMessage({ file });
  }, [reload]);

  const onPick = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!/\.xlsx?$/i.test(f.name)) { setError(`${f.name} is not a workbook.`); return; }
    start(f);
  };

  const busy = !!prog && prog.phase !== "done" && prog.phase !== "error";
  const pct = prog && "pct" in prog ? prog.pct : prog?.phase === "done" ? 100 : 0;

  return (
    <div className="space-y-5">
      {ready && !snapshot ? (
        <p className="rounded border border-ink-200 bg-white px-3 py-2 text-xs text-ink-700">
          No corpus loaded in this browser.
        </p>
      ) : null}

      {snapshot ? (
        <section className={`card card-pad ${snapshot.workbookVerified ? "border-good/40 bg-good/[0.05]" : "border-bad/40 bg-bad/[0.05]"}`}>
          <SectionHeader
            kicker={snapshot.workbookVerified ? "Workbook verified" : "Workbook not verified"}
            title={snapshot.asOf
              ? `Cut-off ${snapshot.asOf}`
              : snapshot.workbookVerified
                ? "Cut-off not declared by the workbook"
                : "Cut-off withheld"}
          >
            <div className="flex items-center gap-2">
              <Link href="/quality" className="btn btn-active">Open the analysis</Link>
              <button type="button" className="btn" onClick={() => void clear()}>Remove</button>
            </div>
          </SectionHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Incidents" value={fmt(snapshot.population.user)} sub="User_Detail population" />
            <Fact label="Alerts" value={fmt(snapshot.population.alert)} sub="Alert_Detail population" />
            <Fact label="Total" value={fmt(snapshot.population.total)} sub="Overview" />
            <Fact label="Report generated" value={snapshot.generatedAt ?? "Not declared"} sub={snapshot.fileName} mono={false} />
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeader kicker="Step 1" title="Load a QN workbook" />
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onPick(e.dataTransfer.files); }}
          className={`card flex flex-col items-center gap-3 border-2 border-dashed px-6 py-9 text-center transition ${
            drag ? "border-pep-500 bg-pep-50" : "border-ink-300"
          }`}
        >
          <div className="text-sm font-medium text-ink-900">Drop the .xlsx here, or choose it</div>
          <p className="subtle max-w-lg">
            Parsed in a Web Worker, indexed into this browser. No server upload. Replacing the
            workbook replaces the corpus.
          </p>
          <input ref={fileInput} type="file" accept=".xlsx,.xls" className="hidden"
                 onChange={(e) => onPick(e.target.files)} />
          <button type="button" className="btn btn-active" disabled={busy}
                  onClick={() => fileInput.current?.click()}>
            {busy ? "Reading…" : "Choose a workbook"}
          </button>
        </div>

        {busy || prog?.phase === "done" ? (
          <div className="card card-pad mt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="label">{phaseLabel(prog!)}</span>
              <span className="num text-ink-500">{pct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-ink-100">
              <div className="h-full rounded bg-pep-700 transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 rounded border border-bad/40 bg-bad/[0.06] px-3 py-2 text-xs text-ink-900">
            Nothing written. {error}
          </p>
        ) : null}
      </section>

      {snapshot ? (
        <>
          <section>
            <SectionHeader kicker="Step 2" title="Datasets" />
            <div className="card overflow-hidden">
              <div className="scroll-thin max-h-[460px] overflow-auto">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 border-b border-ink-200 bg-pep-50">
                    <tr>
                      <th className="th">Sheet</th>
                      <th className="th">Role</th>
                      <th className="th">Scope</th>
                      <th className="th text-right">Loaded</th>
                      <th className="th text-right">Represents</th>
                      <th className="th">Contract</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {snapshot.sheets.map((s) => (
                      <tr key={s.sheet}>
                        <td className="num td">{s.sheet}</td>
                        <td className="td text-ink-600">{s.role.split(" — ")[0]}</td>
                        <td className="td"><ScopeChip scope={s.scope} /></td>
                        <td className="num td text-right">{fmt(s.loadedRows)}</td>
                        <td className="num td text-right text-ink-600">
                          {s.scope === "full" ? "—" : s.representedRows == null ? "—" : fmt(s.representedRows)}
                        </td>
                        <td className="td text-ink-600">
                          {s.missingColumns.length
                            ? <span className="text-bad">{s.missingColumns.length} absent</span>
                            : s.role.startsWith("banner") ? <span className="subtle">not column-checked</span> : "complete"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section>
            <SectionHeader kicker="Step 3" title="Invariants" >
              <span className="subtle num">
                {snapshot.invariants.filter((i) => i.passed).length} of {snapshot.invariants.length} pass
              </span>
            </SectionHeader>
            <div className="card overflow-hidden">
              <table className="w-full border-collapse">
                <thead className="border-b border-ink-200 bg-pep-50">
                  <tr>
                    <th className="th">Id</th><th className="th">Class</th>
                    <th className="th">Statement</th><th className="th">Measured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {snapshot.invariants.map((i) => (
                    <tr key={i.id} className={i.passed ? "" : "bg-bad/[0.05]"}>
                      <td className="num td">{i.id}</td>
                      <td className="td text-ink-600">{i.cls}</td>
                      <td className="td whitespace-normal text-ink-900">{i.statement}</td>
                      <td className="num td whitespace-normal text-xs text-ink-600">{i.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {snapshot.unverifiedDatasets.length ? (
              <p className="mt-2 rounded border border-bad/40 bg-bad/[0.06] px-3 py-2 text-xs text-ink-900">
                Not presented as verified: {snapshot.unverifiedDatasets.join(", ")}.
              </p>
            ) : null}
          </section>

          {snapshot.discarded.length ? (
            <p className="rounded border border-ev-e2/40 bg-ev-e2/[0.07] px-3 py-2 text-xs text-ink-900">
              Discarded: {snapshot.discarded.map((d) => `${fmt(d.rows)} from ${d.store} (${d.reason})`).join(" · ")}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function phaseLabel(p: IngestProgress) {
  switch (p.phase) {
    case "reading": return "Reading the file";
    case "parsing": return `Parsing${"note" in p && p.note ? ` · ${p.note}` : ""}`;
    case "validating": return "Validating";
    case "deriving": return "Deriving datasets";
    case "indexing": return `Indexing ${p.store} · ${fmt(p.done)} of ${fmt(p.total)}`;
    case "done": return "Done";
    default: return "";
  }
}

export function ScopeChip({ scope }: { scope: Scope }) {
  const cls =
    scope === "full" ? "border-good/45 bg-good/10 text-good"
    : scope === "sample" ? "border-ev-e2/45 bg-ev-e2/10 text-ev-e2"
    : "border-ink-300 bg-ink-100 text-ink-500";
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {scopeLabel(scope)}
    </span>
  );
}

function Fact({ label, value, sub, mono = true }: { label: string; value: string; sub?: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div className={`${mono ? "num " : ""}mt-0.5 truncate text-lg font-semibold text-ink-900`}>{value}</div>
      {sub ? <div className="subtle num truncate">{sub}</div> : null}
    </div>
  );
}
