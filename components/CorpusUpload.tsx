"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { IngestProgress, IngestReport } from "@/lib/qn/types";
import { deleteCorpus, readCorpusMeta, type CorpusMeta } from "@/lib/qn/db";
import { SectionHeader, Note } from "./SectionHeader";
import { EvidenceBadge } from "./EvidenceBadge";

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Seccion de carga del corpus QN.
 *
 * El validador corre ANTES de indexar, y su resultado decide si la app estampa
 * la fecha de corte. Un archivo que no cuadra con el manifiesto se declara
 * corpus sin verificar; sus cifras siguen siendo visibles, pero sin sello.
 */
export function CorpusUpload() {
  const [meta, setMeta] = useState<CorpusMeta | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [prog, setProg] = useState<IngestProgress | null>(null);
  const [report, setReport] = useState<IngestReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const worker = useRef<Worker | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    readCorpusMeta().then((m) => {
      setMeta(m);
      setLoaded(true);
    });
    return () => worker.current?.terminate();
  }, []);

  const start = useCallback((file: File) => {
    setError(null);
    setReport(null);
    setProg({ phase: "reading", pct: 0 });
    worker.current?.terminate();
    const w = new Worker(new URL("../lib/qn/ingest.worker.ts", import.meta.url));
    worker.current = w;
    w.onmessage = (e: MessageEvent<IngestProgress>) => {
      const m = e.data;
      setProg(m);
      if (m.phase === "done") {
        setReport(m.report);
        readCorpusMeta().then(setMeta);
        w.terminate();
      }
      if (m.phase === "error") {
        setError(m.message);
        w.terminate();
      }
    };
    w.onerror = (ev) => setError(ev.message || "The worker failed while reading the workbook.");
    w.postMessage({ file });
  }, []);

  const onPick = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!/\.xlsx?$/i.test(f.name)) {
      setError(`${f.name} is not a workbook. The corpus arrives as .xlsx.`);
      return;
    }
    start(f);
  };

  const busy = !!prog && prog.phase !== "done" && prog.phase !== "error";
  const pct = prog && "pct" in prog ? prog.pct : prog?.phase === "done" ? 100 : 0;

  return (
    <div className="space-y-5">
      <CorpusStatus meta={meta} loaded={loaded} onDrop={async () => {
        await deleteCorpus();
        setMeta(null);
        setReport(null);
      }} />

      <section>
        <SectionHeader kicker="Step 1 · the workbook stays in this browser" title="Load a QN v2.4.2 corpus" />

        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onPick(e.dataTransfer.files); }}
          className={`card flex flex-col items-center gap-3 border-2 border-dashed px-6 py-10 text-center transition ${
            drag ? "border-pep-500 bg-pep-50" : "border-ink-300"
          }`}
        >
          <div className="text-sm font-medium text-ink-900">
            Drop <span className="num">QN_p…_2_4_2_RO.xlsx</span> here, or choose it
          </div>
          <p className="max-w-xl text-xs leading-relaxed text-ink-600">
            The detail sheets are parsed in a Web Worker and indexed into this browser&rsquo;s IndexedDB.
            Nothing is uploaded to a server. The file is checked against the build manifest
            <span className="num"> data/QN_v242_contract.json</span> before a single row is written.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => onPick(e.target.files)}
          />
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
          <div className="mt-3">
            <Note tone="warn">
              <strong>Nothing was written.</strong> {error}
            </Note>
          </div>
        ) : null}
      </section>

      {report ? <Report report={report} /> : null}
    </div>
  );
}

function phaseLabel(p: IngestProgress) {
  switch (p.phase) {
    case "reading": return "Reading the file";
    case "parsing": return `Parsing the workbook${"note" in p && p.note ? ` · ${p.note}` : ""}`;
    case "validating": return "Validating against the manifest";
    case "indexing": return `Indexing ${p.store} · ${fmt(p.done)} of ${fmt(p.total)}`;
    case "done": return "Done";
    default: return "";
  }
}

function CorpusStatus({ meta, loaded, onDrop }: { meta: CorpusMeta | null; loaded: boolean; onDrop: () => void }) {
  if (!loaded) return null;
  if (!meta) {
    return (
      <Note>
        No corpus is loaded in this browser. The dashboard keeps working on the semantic layer at its own
        cut-off; the ticket-level screens and the agent&rsquo;s detail tools stay unanswerable until a workbook
        is loaded here, and they say so rather than estimating.
      </Note>
    );
  }
  return (
    <section className={`card card-pad ${meta.verified ? "border-good/40 bg-good/[0.05]" : "border-ev-e2/50 bg-ev-e2/[0.06]"}`}>
      <SectionHeader
        kicker={meta.verified ? "Corpus loaded · manifest verified" : "Corpus loaded · NOT verified"}
        title={meta.verified ? `Cut-off ${meta.as_of}` : "Cut-off withheld"}
      >
        <button type="button" className="btn" onClick={onDrop}>Remove from this browser</button>
      </SectionHeader>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="User incidents indexed" value={fmt(meta.rows?.user ?? 0)} />
        <Fact label="Alerts indexed" value={fmt(meta.rows?.alert ?? 0)} />
        <Fact label="Instrument" value={meta.instrument} mono={false} />
        <Fact label="sha256" value={`${meta.sha256.slice(0, 16)}…`} />
      </div>
      {!meta.verified ? (
        <div className="mt-3">
          <Note tone="warn">
            This corpus did not match the manifest, so <strong>the cut-off date is not stamped</strong> and every
            figure derived from it is labelled unverified. A date on screen is a claim backed by invariants; it is
            not a property of whatever file was dropped in.
          </Note>
        </div>
      ) : meta.complete === false ? (
        <div className="mt-3">
          <Note tone="warn">
            The structure matches the corpus but the volume does not: this is a <strong>sample</strong>. Figures
            computed from it describe the rows loaded here, never the full population.
          </Note>
        </div>
      ) : null}
    </section>
  );
}

function Fact({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`${mono ? "num " : ""}mt-0.5 truncate text-sm font-semibold text-ink-900`}>{value}</div>
    </div>
  );
}

function Report({ report: r }: { report: IngestReport }) {
  const bad = r.sheets.filter((s) => !s.ok);
  return (
    <section className="space-y-3">
      <SectionHeader
        kicker="Step 2 · what the gate found"
        title={r.verified ? "The file matches the manifest" : "The file does not match the manifest"}
      >
        <EvidenceBadge tier={r.verified ? "E1" : "E3"} showAuthority />
      </SectionHeader>

      <div className="card card-pad">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="File" value={r.fileName} mono={false} />
          <Fact label="Size" value={`${(r.fileSize / 1024 / 1024).toFixed(1)} MB`} />
          <Fact label="User rows indexed" value={`${fmt(r.indexed.user)} of ${fmt(r.declared.user)} declared`} />
          <Fact label="Alert rows indexed" value={`${fmt(r.indexed.alert)} of ${fmt(r.declared.alert)} declared`} />
        </div>
      </div>

      {/* Note renderiza un <p>, y un <p> no puede contener una lista: este
          bloque lleva su propio contenedor en vez de anidar mal el DOM. */}
      {r.failures.length ? (
        <div className="rounded border border-ev-e2/40 bg-ev-e2/[0.07] px-3 py-2 text-xs leading-relaxed text-ink-900">
          <strong>{r.failures.length} contract failure{r.failures.length === 1 ? "" : "s"}.</strong>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {r.failures.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      ) : null}

      {r.discarded.length ? (
        <Note tone="warn">
          Rows discarded, with the reason:{" "}
          {r.discarded.map((d) => `${fmt(d.rows)} from ${d.store} (${d.reason})`).join(" · ")}. They are reported
          here rather than dropped quietly.
        </Note>
      ) : null}

      {r.warnings.map((w) => <Note key={w}>{w}</Note>)}

      <div className="card overflow-hidden">
        <div className="scroll-thin max-h-[420px] overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 border-b border-ink-200 bg-pep-50">
              <tr>
                <th className="th">Sheet</th>
                <th className="th">Role</th>
                <th className="th">Columns in the contract</th>
                <th className="th">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {r.sheets.map((s) => (
                <tr key={s.sheet}>
                  <td className="num td">{s.sheet}</td>
                  <td className="td text-ink-600">{s.role}</td>
                  <td className="td text-ink-600">
                    {s.missingColumns.length
                      ? <span className="text-bad">missing {s.missingColumns.length}: {s.missingColumns.slice(0, 3).join(", ")}{s.missingColumns.length > 3 ? "…" : ""}</span>
                      : s.role === "banner" ? <span className="subtle">not column-checked</span> : "all present"}
                    {s.extraColumns.length ? <span className="subtle"> · {s.extraColumns.length} undeclared, not read</span> : null}
                  </td>
                  <td className="td">
                    {s.ok
                      ? <span className="rounded border border-good/40 bg-good/10 px-1.5 py-0.5 text-[11px] font-semibold text-good">ok</span>
                      : <span className="rounded border border-bad/40 bg-bad/10 px-1.5 py-0.5 text-[11px] font-semibold text-bad">{s.present ? "contract broken" : "absent"}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {bad.length === 0 ? (
        <Note>
          Nothing left to check. The ticket-level tools are live in this browser:{" "}
          <Link href="/agent" className="font-medium text-pep-700 underline decoration-pep-500/40 underline-offset-2">
            ask the operational agent
          </Link>{" "}
          for a ticket, a group profile or the recurring signatures.
        </Note>
      ) : null}
    </section>
  );
}
