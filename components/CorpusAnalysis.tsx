"use client";
import Link from "next/link";
import { useState } from "react";
import { useCorpus, useDataset, num, fmt } from "@/lib/qn/corpus";
import type { Provenance } from "@/lib/qn/types";
import { ScopeChip } from "./CorpusUpload";
import { SectionHeader } from "./SectionHeader";

/**
 * Analisis del corpus cargado. Todo sale del libro que esta en este navegador.
 *
 * Regla de autoridad aplicada: las cifras de poblacion salen de las hojas
 * agregadas que cubren el corpus, nunca de las filas de detalle. Cada bloque
 * declara su hoja de origen y su alcance, y el panel de procedencia responde
 * como se calculo.
 */
export function CorpusAnalysis() {
  const { snapshot, ready } = useCorpus();
  if (!ready) return null;
  if (!snapshot) {
    return (
      <section className="card card-pad">
        <SectionHeader kicker="Corpus" title="No corpus loaded">
          <Link href="/upload" className="btn btn-active">Load Data</Link>
        </SectionHeader>
        <p className="subtle">
          Sheet-level analysis appears here once a QN workbook is loaded in this browser.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader
          kicker={
            snapshot.asOf
              ? `${snapshot.instrument} · cut-off ${snapshot.asOf}`
              : `${snapshot.instrument} · report generated ${snapshot.generatedAt ?? "not declared"} · cut-off not declared`
          }
          title={snapshot.asOf ? `Corpus at ${snapshot.asOf}` : "Corpus"}
        >
          <Link href="/upload" className="btn">Datasets and invariants</Link>
        </SectionHeader>
        <Population />
      </section>

      <DualAxis />
      <Decalogue />
      <Compliance />
      <TopGroups />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Block({
  title, kicker, prov, children, right,
}: {
  title: string;
  kicker: string;
  prov: Provenance | null;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <SectionHeader kicker={kicker} title={title}>
        <div className="flex items-center gap-2">
          {right}
          {prov ? <ScopeChip scope={prov.scope} /> : null}
          {prov ? (
            <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              Source
            </button>
          ) : null}
        </div>
      </SectionHeader>
      {open && prov ? (
        <dl className="card card-pad mb-3 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-5">
          <Meta k="Source sheet" v={prov.sourceSheet} />
          <Meta k="Scope" v={prov.scope} />
          <Meta k="Loaded rows" v={fmt(prov.loadedRows)} />
          <Meta k="Represents" v={prov.representedRows == null ? "—" : fmt(prov.representedRows)} />
          <Meta k="Coverage test" v={prov.scopeEvidence ?? "—"} />
          <div className="sm:col-span-2 lg:col-span-5">
            <dt className="label">Calculation</dt>
            <dd className="mt-0.5 text-ink-700">{prov.calculation}</dd>
          </div>
        </dl>
      ) : null}
      {children}
    </section>
  );
}

const Meta = ({ k, v }: { k: string; v: string }) => (
  <div className="min-w-0">
    <dt className="label">{k}</dt>
    <dd className="num mt-0.5 truncate text-ink-900">{v}</dd>
  </div>
);

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card card-pad">
      <div className="label">{label}</div>
      <div className="num mt-0.5 text-2xl font-semibold text-pep-900">{value}</div>
      {sub ? <div className="subtle num mt-0.5">{sub}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Population() {
  const { snapshot } = useCorpus();
  const ov = useDataset("overview");
  const ud = useDataset("userDetail");
  const ad = useDataset("alertDetail");
  const p = snapshot!.population;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile label="Incidents" value={fmt(p.user)} sub="Full corpus · Overview" />
      <Tile label="Alerts" value={fmt(p.alert)} sub="Full corpus · Overview" />
      <Tile label="Total" value={fmt(p.total)} sub={ov.verified ? "Reconciles: QN05" : "Unverified"} />
      <Tile
        label="Detail records loaded"
        value={`${fmt(ud.provenance?.loadedRows ?? 0)} + ${fmt(ad.provenance?.loadedRows ?? 0)}`}
        sub={(() => {
          const r = (ud.facts.closedAt ?? {}) as Record<string, string>;
          const scope = ud.scope === "full" ? "Full corpus" : "Sample";
          return r.first ? `${scope} · Closed At ${r.first} to ${r.last}` : `${scope} · User_Detail, Alert_Detail`;
        })()}
      />
    </div>
  );
}

function DualAxis() {
  const d = useDataset("dualAxis");
  if (!d.present) return null;
  const cols = ["DIAGNOSTICO (n)", "SUSTANTIVO (n)", "FORMAL_ONLY (n)", "EMPTY (n)"] as const;
  const pcts = ["DIAGNOSTICO (row %)", "SUSTANTIVO (row %)", "FORMAL_ONLY (row %)", "EMPTY (row %)"] as const;
  const label = "Label (Axis 1 — process)";
  const total = d.facts.total as Record<string, number | string> | undefined;

  return (
    <Block kicker="Quality band × close-notes class" title="Dual axis" prov={d.provenance}>
      <div className="card overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-ink-200 bg-pep-50">
              <tr>
                <th className="th">Band</th>
                {cols.map((c) => <th key={c} className="th text-right">{c.replace(" (n)", "")}</th>)}
                <th className="th text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {d.rows.map((r: any) => (
                <tr key={String(r[label])}>
                  <td className="td font-medium">{String(r[label])}</td>
                  {cols.map((c, i) => (
                    <td key={c} className="num td text-right">
                      {fmt(num(r[c]))}
                      <span className="subtle"> {num(r[pcts[i]])}%</span>
                    </td>
                  ))}
                  <td className="num td text-right font-semibold">{fmt(num(r.Total))}</td>
                </tr>
              ))}
              {total ? (
                <tr className="border-t-2 border-ink-300 bg-pep-50">
                  <td className="td font-semibold">Total</td>
                  {cols.map((c) => <td key={c} className="num td text-right font-semibold">{fmt(num(total[c]))}</td>)}
                  <td className="num td text-right font-semibold">{fmt(num(total.Total))}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </Block>
  );
}

function Decalogue() {
  const d = useDataset("byDecalogue");
  if (!d.present) return null;
  const s = (d.facts.summary ?? {}) as Record<string, number>;

  return (
    <Block kicker="Decalogue" title="Classified incidents and code occurrences" prov={d.provenance}>
      {/* Dos unidades distintas, no una cifra con aviso. */}
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <Tile label="Classified incidents" value={fmt(s.classifiedIncidents)} sub="unit: incident" />
        <Tile label="Decalogue occurrences" value={fmt(s.codeOccurrences)} sub="unit: occurrence" />
        <Tile label="Overcount" value={fmt(s.overcount)} sub="incidents carrying more than one code" />
      </div>
      <div className="card overflow-hidden">
        <div className="scroll-thin max-h-[360px] overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 border-b border-ink-200 bg-pep-50">
              <tr>
                <th className="th">Code</th><th className="th">Pattern</th>
                <th className="th text-right">Occurrences</th><th className="th text-right">Avg score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {([...d.rows] as any[]).sort((a, b) => (num(b.Incidents) ?? 0) - (num(a.Incidents) ?? 0)).map((r) => (
                <tr key={String(r.Code)}>
                  <td className="num td">{String(r.Code)}</td>
                  <td className="td max-w-[320px] truncate">{String(r.Pattern ?? "")}</td>
                  <td className="num td text-right">{fmt(num(r.Incidents))}</td>
                  <td className="num td text-right">{num(r["Avg Score"]) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="subtle mt-2">
        Occurrences sum the code column. An incident carrying two codes counts twice, so the column
        total is not a population.
      </p>
    </Block>
  );
}

function Compliance() {
  const cn = useDataset("complianceCloseNotes");
  const ca = useDataset("complianceAlerts");
  const k1 = (cn.facts["OVERALL KPI"] ?? {}) as Record<string, number | string>;
  const k2 = (ca.facts["OVERALL KPI"] ?? {}) as Record<string, number | string>;
  if (!cn.present && !ca.present) return null;

  return (
    <Block kicker="ADO 4.3.45.2" title="Close-notes compliance" prov={cn.provenance}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Incident population rate" value={pct(k1["Population rate %"])}
              sub={`target ${pct(k1["Target %"])} · ${fmt(num(k1["Populated close_notes"]))} of ${fmt(num(k1["Eligible closed"]))}`} />
        <Tile label="Alert documentation rate" value={pct(k2["Documentation rate %"])}
              sub={`target ${pct(k2["Target %"])} · ${fmt(num(k2["Populated close_notes"]))} of ${fmt(num(k2["Eligible closed"]))}`} />
        <Tile label="Avg score with close notes" value={String(k1["Avg score WITH close_notes"] ?? "—")} sub="points out of 100" />
        <Tile label="Avg score without" value={String(k1["Avg score WITHOUT close_notes"] ?? "—")} sub="points out of 100" />
      </div>
    </Block>
  );
}

const pct = (v: unknown) => (num(v) == null ? "Not calculated" : `${num(v)}%`);

function TopGroups() {
  const d = useDataset("userByGroup");
  const [n, setN] = useState(15);
  if (!d.present) return null;
  const rows = ([...d.rows] as any[]).sort((a, b) => (num(b.Incidents) ?? 0) - (num(a.Incidents) ?? 0));
  const shown = rows.slice(0, n);
  const sumIncidents = (list: any[]) => list.reduce((acc: number, r) => acc + (num(r.Incidents) ?? 0), 0);
  const covered = sumIncidents(shown);
  const all = sumIncidents(rows);

  return (
    <Block
      kicker={`${fmt(rows.length)} assignment groups`}
      title="Incident volume by assignment group"
      prov={d.provenance}
      right={<span className="subtle num">{fmt(covered)} of {fmt(all)} shown</span>}
    >
      <div className="card overflow-hidden">
        <div className="scroll-thin max-h-[440px] overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 border-b border-ink-200 bg-pep-50">
              <tr>
                <th className="th">Assignment group</th>
                <th className="th text-right">Incidents</th>
                <th className="th text-right">Avg score</th>
                <th className="th text-right">Close notes %</th>
                <th className="th text-right">Poor + Critical</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {shown.map((r: any) => {
                const inc = num(r.Incidents) ?? 0;
                const poor = (num(r.Poor) ?? 0) + (num(r.Critical) ?? 0);
                return (
                  <tr key={String(r["Assignment Group"])} className="hover:bg-pep-50">
                    <td className="td max-w-[340px] truncate">{String(r["Assignment Group"])}</td>
                    <td className="num td text-right">{fmt(inc)}</td>
                    <td className="num td text-right">{num(r["Avg Score"]) ?? "—"}</td>
                    <td className="num td text-right">{num(r["Close Notes %"]) ?? "—"}</td>
                    <td className="num td text-right">
                      {fmt(poor)}<span className="subtle"> of {fmt(inc)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {n < rows.length ? (
          <div className="border-t border-ink-200 bg-pep-50 px-3 py-2 text-center">
            <button type="button" className="btn" onClick={() => setN((v) => v + 40)}>
              Show more — {n} of {fmt(rows.length)}
            </button>
          </div>
        ) : null}
      </div>
    </Block>
  );
}
