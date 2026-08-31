"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { quality, sectors } from "@/lib/data";
import { useCorpus, useDataset } from "@/lib/qn/corpus";
import {
  buildPortfolioRiskPack,
  deriveXOpsContext,
} from "@/lib/agent/insights/portfolio-risk";
import {
  buildOperationalHealthAnalysis,
  type OperationalAnalysis,
  type OperationalSignalRow,
} from "@/lib/agent/operational-health";
import type {
  EvidencePack,
  PortfolioRiskScope,
  StructuredAnswer,
} from "@/lib/agent/insights/types";
import {
  CAPABILITIES,
  type CapabilityId,
  type CapabilityMeta,
} from "@/lib/agent/capabilities";

/* --------------------------------------------------------------------------
 * Ask XOps — capability home + capability flows.
 *
 * The drawer is portalled to document.body so `position: fixed` resolves
 * against the viewport (the layout header uses backdrop-blur, which turns
 * itself into a containing block for fixed descendants).
 *
 * Each capability has its own view. Only Portfolio Risk executes an LLM
 * request. Operational Health surfaces corpus state and links to Load Data;
 * its backend is deliberately deferred to the next iteration.
 * ------------------------------------------------------------------------ */

type View = "home" | CapabilityId;
type Phase = "idle" | "calling" | "answered" | "error";

/* --------------------------------- helpers --------------------------------- */

const SECTORS_SORTED = [...sectors].sort((a, b) =>
  a.name.localeCompare(b.name),
);

function scopeLabel(scope: PortfolioRiskScope): string {
  if (scope.kind === "ai_ml_segment") return "AI/ML segment";
  return sectors.find((s) => s.sector_id === scope.sector_id)?.name ?? scope.sector_id;
}

function translateHttpError(
  status: number,
  vercelErr: string | null,
): string {
  if (status === 504 || vercelErr === "FUNCTION_INVOCATION_TIMEOUT") {
    return "The analysis took longer than expected. Please try again.";
  }
  if (status === 429) {
    return "The analysis service is temporarily busy. Please try again shortly.";
  }
  if (status === 401 || status === 403) {
    return "The analysis service is not available. Please contact the administrator.";
  }
  if (status >= 500) {
    return "The analysis could not be completed. Please try again.";
  }
  return "The analysis could not be completed. Please try again.";
}

/* --------------------------------- shell ---------------------------------- */

export function AskXOps() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <button
        type="button"
        className="rounded bg-pep-900 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-pep-800"
        onClick={() => setOpen(true)}
        aria-label="Ask XOps"
      >
        Ask XOps ✦
      </button>
      {open && mounted &&
        createPortal(<Drawer onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function Drawer({ onClose }: { onClose: () => void }) {
  const pathname = usePathname() ?? "";
  const params = useParams() as Record<string, string | string[] | undefined>;
  const context = useMemo(
    () => deriveXOpsContext(pathname, params),
    [pathname, params],
  );

  const defaultScope: PortfolioRiskScope = useMemo(() => {
    if (context.kind === "ai_ml_segment") return { kind: "ai_ml_segment" };
    if (context.kind === "sector")
      return { kind: "sector", sector_id: context.sector_id };
    return { kind: "ai_ml_segment" };
  }, [context]);

  const [view, setView] = useState<View>("home");
  const [scope, setScope] = useState<PortfolioRiskScope>(defaultScope);

  return (
    <div
      className="fixed inset-0 z-50 flex bg-ink-900/30"
      role="dialog"
      aria-label="Ask XOps"
      onClick={onClose}
    >
      <div
        className="ml-auto flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <DrawerHeader
          view={view}
          onBack={view !== "home" ? () => setView("home") : undefined}
          onClose={onClose}
        />
        <div className="flex-1 overflow-y-auto">
          {view === "home" && (
            <CapabilityHome
              scope={scope}
              setScope={setScope}
              onSelect={setView}
            />
          )}
          {view === "portfolio_risk" && (
            <PortfolioRiskFlow scope={scope} setScope={setScope} />
          )}
          {view === "operational_health" && <OperationalHealthFlow />}
        </div>
      </div>
    </div>
  );
}

function DrawerHeader({
  view,
  onBack,
  onClose,
}: {
  view: View;
  onBack?: () => void;
  onClose: () => void;
}) {
  const title =
    view === "home"
      ? "Ask XOps"
      : CAPABILITIES.find((c) => c.id === view)?.label ?? "Ask XOps";
  const subtitle =
    view === "home" ? "Operational intelligence grounded in evidence" : null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-ink-200 px-4 py-3">
      <div className="min-w-0">
        {onBack && (
          <button
            type="button"
            className="mb-1 text-xs text-ink-500 hover:text-pep-900"
            onClick={onBack}
          >
            ← Back
          </button>
        )}
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {view === "home" ? "ASK XOPS ✦" : "CAPABILITY"}
        </div>
        <div className="mt-0.5 text-lg font-semibold text-pep-900">
          {title}
        </div>
        {subtitle && (
          <div className="text-xs text-ink-600">{subtitle}</div>
        )}
      </div>
      <button
        type="button"
        className="shrink-0 rounded border border-ink-300 px-2 py-1 text-xs text-ink-700 hover:bg-ink-50"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
}

/* ------------------------------- capability home ------------------------- */

function CapabilityHome({
  scope,
  setScope,
  onSelect,
}: {
  scope: PortfolioRiskScope;
  setScope: (s: PortfolioRiskScope) => void;
  onSelect: (v: View) => void;
}) {
  return (
    <div className="space-y-5 p-4">
      <ScopePicker scope={scope} setScope={setScope} />
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          What do you want to understand?
        </div>
        <div className="mt-2 space-y-2">
          {CAPABILITIES.map((c) => (
            <CapabilityCard key={c.id} c={c} onSelect={onSelect} />
          ))}
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-ink-500">
        Every capability declares its evidence source and its supported
        question. XOps deterministic logic decides what evidence enters each
        answer; the model explains, it does not rank or invent.
      </p>
    </div>
  );
}

function CapabilityCard({
  c,
  onSelect,
}: {
  c: CapabilityMeta;
  onSelect: (v: View) => void;
}) {
  const active = c.status === "available" || c.status === "beta";
  const badge =
    c.status === "available"
      ? { label: "AVAILABLE", cls: "bg-pep-900 text-white" }
      : c.status === "beta"
        ? { label: "BETA", cls: "bg-pep-100 text-pep-900" }
        : { label: "COMING NEXT", cls: "bg-ink-100 text-ink-500" };
  return (
    <button
      type="button"
      disabled={!active}
      onClick={() => active && onSelect(c.id)}
      aria-disabled={!active}
      data-capability={c.id}
      className={`w-full rounded border p-3 text-left transition ${
        active
          ? "border-ink-200 hover:border-pep-500 hover:bg-pep-50"
          : "cursor-not-allowed border-ink-100 bg-ink-50/50 opacity-70"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-pep-900">{c.label}</div>
          <div className="mt-0.5 text-sm italic text-ink-700">
            {c.question}
          </div>
        </div>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>
      <div className="mt-2 text-xs leading-relaxed text-ink-600">
        {c.description}
      </div>
      <div className="mt-2 text-[11px] text-ink-500">
        Evidence · <span className="font-semibold text-ink-700">{c.evidence}</span>
      </div>
    </button>
  );
}

function ScopePicker({
  scope,
  setScope,
}: {
  scope: PortfolioRiskScope;
  setScope: (s: PortfolioRiskScope) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-500">
        Scope
      </label>
      <select
        className="w-full rounded border border-ink-300 bg-white px-2 py-1.5 text-sm"
        value={scope.kind === "ai_ml_segment" ? "__ai" : scope.sector_id}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__ai") setScope({ kind: "ai_ml_segment" });
          else setScope({ kind: "sector", sector_id: v });
        }}
      >
        <option value="__ai">AI/ML segment</option>
        {SECTORS_SORTED.map((s) => (
          <option key={s.sector_id} value={s.sector_id}>
            {s.name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[11px] text-ink-500">
        Scope applies to capabilities based on the semantic layer. Operational
        Health uses whatever corpus is loaded in this browser.
      </p>
    </div>
  );
}

/* ---------------------------- Portfolio Risk flow ------------------------- */

function PortfolioRiskFlow({
  scope,
  setScope,
}: {
  scope: PortfolioRiskScope;
  setScope: (s: PortfolioRiskScope) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pack, setPack] = useState<EvidencePack | null>(null);
  const [answer, setAnswer] = useState<StructuredAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Preview universe before analysing — computed via the pack builder so the
  // number is exactly what will be used by the LLM.
  const previewUniverse = useMemo(() => {
    try {
      return buildPortfolioRiskPack(scope).metadata.scope_universe;
    } catch {
      return null;
    }
  }, [scope]);

  const analyze = async () => {
    setPhase("calling");
    setError(null);
    setAnswer(null);
    const built = buildPortfolioRiskPack(scope);
    setPack(built);
    try {
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ evidence_pack: built }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");
      const vercelErr = res.headers.get("x-vercel-error");
      let body: unknown = null;
      try {
        body = isJson ? await res.json() : await res.text();
      } catch {
        /* body unreadable */
      }
      if (!res.ok) {
        console.warn("[AskXOps] request failed", {
          status: res.status,
          vercelErr,
          contentType,
          body,
        });
        setError(translateHttpError(res.status, vercelErr));
        setPhase("error");
        return;
      }
      if (!isJson || body === null || typeof body !== "object") {
        console.warn("[AskXOps] unexpected response shape", {
          status: res.status,
          contentType,
          body,
        });
        setError("Unexpected server response. Please try again.");
        setPhase("error");
        return;
      }
      setAnswer((body as { answer: StructuredAnswer }).answer);
      setPhase("answered");
    } catch (e: unknown) {
      console.warn("[AskXOps] network error", e);
      setError("The analysis could not be completed. Please try again.");
      setPhase("error");
    }
  };

  if (phase === "answered" && answer && pack) {
    return (
      <div className="space-y-4 p-4">
        <PortfolioRiskDecisionBrief
          scope={scope}
          pack={pack}
          answer={answer}
          onRerun={analyze}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        Ready to analyze
      </div>
      <div>
        <ScopePicker scope={scope} setScope={setScope} />
      </div>
      <FactRow label="Evidence" value="Semantic Layer" />
      <FactRow
        label="Applications screened"
        value={previewUniverse !== null ? String(previewUniverse) : "—"}
      />
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          Question
        </div>
        <p className="mt-1 text-sm text-ink-900">
          What needs attention first, and why?
        </p>
      </div>
      <button
        type="button"
        className="w-full rounded bg-pep-900 px-3 py-2 text-sm font-semibold text-white hover:bg-pep-800 disabled:opacity-50"
        onClick={analyze}
        disabled={phase === "calling"}
      >
        {phase === "calling" ? "Analyzing grounded evidence…" : "Analyze Portfolio Risk"}
      </button>
      {phase === "error" && (
        <div className="rounded border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          {error}
        </div>
      )}
      <p className="text-[11px] text-ink-500">
        The model receives a deterministic screening of up to ten candidates
        drawn from the scope universe. It explains the candidates. It does not
        rank, refilter, or invent identifiers.
      </p>
    </div>
  );
}

function PortfolioRiskDecisionBrief({
  scope,
  pack,
  answer,
  onRerun,
}: {
  scope: PortfolioRiskScope;
  pack: EvidencePack;
  answer: StructuredAnswer;
  onRerun: () => void;
}) {
  const nameById = new Map(pack.applications.map((a) => [a.app_id, a.name]));
  const meta = pack.metadata;
  return (
    <>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-ink-500">
          {scopeLabel(scope)} · Portfolio Risk
        </div>
        <div className="mt-1 text-lg font-semibold text-pep-900">
          Decision Brief
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniStat label="Applications screened" value={String(meta.scope_universe)} />
        <MiniStat label="Candidates analyzed" value={String(pack.applications.length)} />
      </div>

      <Section title="Executive Assessment">
        <p className="text-sm leading-relaxed text-ink-900">{answer.answer}</p>
      </Section>

      <Section title="Top Priorities">
        <ol className="space-y-2">
          {answer.findings.map((f, i) => (
            <li
              key={i}
              className="rounded border border-ink-200 p-2.5 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 font-semibold text-pep-900">
                  {nameById.get(f.app_id) ?? f.app_id}{" "}
                  <span className="text-xs font-normal text-ink-500">
                    · {f.app_id}
                  </span>
                </div>
                <Link
                  href={`/app/${encodeURIComponent(f.app_id)}`}
                  className="shrink-0 rounded border border-ink-200 px-1.5 py-0.5 text-[10px] font-semibold text-pep-800 hover:bg-pep-50"
                >
                  View application →
                </Link>
              </div>
              <div className="mt-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                  Why it matters
                </div>
                <p className="mt-0.5 text-ink-900">{f.fact}</p>
              </div>
              <div className="mt-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                  Evidence
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {f.signals_combined.map((s, j) => (
                    <span
                      key={j}
                      className="rounded bg-pep-100 px-1.5 py-0.5 text-[10px] font-medium text-pep-800"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                {f.evidence.length > 0 && (
                  <div className="mt-1 text-[10px] text-ink-500">
                    Cited: {f.evidence.join(" · ")}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="What Should Happen Next">
        <p className="text-sm leading-relaxed text-ink-900">
          {answer.recommended_action}
        </p>
      </Section>

      {answer.insight && (
        <Section title="Cross-Cutting Insight">
          <p className="text-sm leading-relaxed text-ink-700">{answer.insight}</p>
        </Section>
      )}

      {(answer.limitations?.length ?? 0) > 0 && (
        <Section title="Limitations">
          <ul className="list-disc pl-4 text-xs leading-relaxed text-ink-600">
            {answer.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </Section>
      )}

      <div className="border-t border-ink-200 pt-2 text-[11px] text-ink-500">
        <div>
          Confidence: <span className="font-semibold text-ink-700">{answer.confidence}</span>
          {" · "}Evidence source: Semantic Layer
        </div>
        <div className="mt-1">
          Cut-off {meta.as_of} · universe {meta.universe_apps} applications.
        </div>
        <div className="mt-1 italic">{meta.ranking.disclaimer}</div>
      </div>

      <button
        type="button"
        className="w-full rounded border border-ink-300 px-3 py-2 text-sm font-medium text-pep-900 hover:bg-pep-50"
        onClick={onRerun}
      >
        Re-analyze
      </button>
    </>
  );
}

/* -------------------------- Operational Health flow ---------------------- */

function OperationalHealthFlow() {
  const { ready, snapshot } = useCorpus();

  if (!ready) {
    return (
      <div className="space-y-3 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          Operational Health · BETA
        </div>
        <p className="text-sm text-ink-700">Checking browser corpus…</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="space-y-4 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          Operational Health · BETA
        </div>
        <div className="rounded border border-warn/40 bg-warn/10 p-3 text-sm text-ink-900">
          Operational corpus required.
          <div className="mt-1 text-xs text-ink-700">
            This capability reads incidents and alerts from the QN operational
            workbook loaded in this browser. Nothing is uploaded to a server.
          </div>
        </div>
        <Link
          href="/upload"
          className="inline-block rounded bg-pep-900 px-3 py-2 text-sm font-semibold text-white hover:bg-pep-800"
        >
          Load data →
        </Link>
        <p className="text-[11px] text-ink-500">
          Portfolio Risk is available without a loaded corpus because it reads
          the semantic layer that ships with the application.
        </p>
      </div>
    );
  }

  // Corpus is loaded. Run the deterministic aggregate analysis directly in
  // the browser and render an Operational Brief. No LLM. The /quality tab
  // stays available as evidence drill-down.
  return <OperationalBrief snapshot={snapshot} />;
}

function OperationalBrief({
  snapshot,
}: {
  snapshot: NonNullable<ReturnType<typeof useCorpus>["snapshot"]>;
}) {
  const ubg = useDataset("userByGroup");
  const abg = useDataset("alertByGroup");

  const analysis = useMemo<OperationalAnalysis>(() => {
    return buildOperationalHealthAnalysis({
      userRows: (ubg.rows ?? []) as any,
      alertRows: (abg.rows ?? []) as any,
      corpus: {
        incidents: snapshot.population.user,
        alerts: snapshot.population.alert,
        total: snapshot.population.total,
      },
      attribution: quality?.meta?.join_coverage
        ? {
            ags_matched: quality.meta.join_coverage.ags_matched ?? null,
            ags_bridge: quality.meta.join_coverage.ags_bridge ?? null,
            ags_quality: quality.meta.join_coverage.ags_quality ?? null,
            incident_coverage_pct:
              quality.meta.join_coverage.incident_coverage_pct ?? null,
          }
        : null,
    });
  }, [ubg.rows, abg.rows, snapshot.population]);

  const anyFindings =
    analysis.findings.cross_signal.length +
      analysis.findings.incident_heavy.length +
      analysis.findings.alert_heavy.length >
    0;

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-ink-500">
          Operational Health · BETA
        </div>
        <div className="mt-1 text-lg font-semibold text-pep-900">
          Operational Brief
        </div>
        <div className="text-xs text-ink-600">
          Scope · Loaded operational corpus
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Incidents" value={fmtNum(analysis.corpus.incidents)} />
        <MiniStat label="Alerts" value={fmtNum(analysis.corpus.alerts)} />
        <MiniStat label="Records" value={fmtNum(analysis.corpus.total)} />
      </div>

      <FactRow label="Evidence" value="QN Operational Corpus" />
      <FactRow label="Workbook" value={snapshot.fileName ?? "unknown"} />
      <FactRow label="Verified" value={snapshot.workbookVerified ? "yes" : "no"} />
      <FactRow label="As of" value={snapshot.asOf ?? "not declared"} />

      {!anyFindings && (
        <div className="rounded border border-ink-200 bg-ink-50/50 p-3 text-sm text-ink-800">
          The loaded corpus does not expose enough Assignment Group aggregates
          to classify operational concentration. Load a workbook that includes
          User_By_Group and Alert_By_Group.
        </div>
      )}

      {analysis.findings.cross_signal.length > 0 && (
        <Section title="Cross-signal concentration">
          <ol className="space-y-2">
            {analysis.findings.cross_signal.map((r) => (
              <OperationalFinding
                key={r.ag_key}
                row={r}
                whyItMatters="Operational activity is concentrated across both incident and alert populations."
              />
            ))}
          </ol>
        </Section>
      )}

      {analysis.findings.incident_heavy.length > 0 && (
        <Section title="Incident-heavy">
          <ol className="space-y-2">
            {analysis.findings.incident_heavy.map((r) => (
              <OperationalFinding
                key={r.ag_key}
                row={r}
                whyItMatters="Operational activity is concentrated primarily in the incident population."
              />
            ))}
          </ol>
        </Section>
      )}

      {analysis.findings.alert_heavy.length > 0 && (
        <Section title="Alert-heavy">
          <ol className="space-y-2">
            {analysis.findings.alert_heavy.map((r) => (
              <OperationalFinding
                key={r.ag_key}
                row={r}
                whyItMatters="Operational activity is concentrated primarily in the alert population."
              />
            ))}
          </ol>
        </Section>
      )}

      {analysis.quality && (
        <Section title="Evidence quality observation">
          <p className="text-sm leading-relaxed text-ink-900">
            {analysis.quality.text}
          </p>
        </Section>
      )}

      <Section title="Application attribution">
        <div className="rounded border border-ink-200 p-2.5 text-sm">
          <div className="font-semibold text-pep-900">
            {analysis.attribution.kind === "verified"
              ? "Verified"
              : analysis.attribution.kind === "partial"
                ? "Partial"
                : "Incomplete / not established"}
            {analysis.attribution.coverage_pct != null && (
              <span className="ml-2 text-xs font-normal text-ink-500">
                {analysis.attribution.coverage_pct.toFixed(1)}% of ticket
                volume via Assignment Group bridge
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-700">
            {analysis.attribution.note}
          </p>
        </div>
      </Section>

      <Section title="What should happen next">
        <p className="text-sm leading-relaxed text-ink-900">
          Review Assignment Groups showing concentration across both
          operational signals, then validate application attribution before
          extending the analysis to business impact.
        </p>
      </Section>

      <Section title="Limitations">
        <ul className="list-disc pl-4 text-xs leading-relaxed text-ink-600">
          {analysis.limitations.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </Section>

      <Link
        href="/quality"
        className="inline-block rounded bg-pep-900 px-3 py-2 text-sm font-semibold text-white hover:bg-pep-800"
      >
        Explore operational evidence →
      </Link>

      <div className="border-t border-ink-200 pt-2 text-[11px] text-ink-500">
        Raw operational records are never sent to the model. Only bounded
        aggregate evidence. Evidence source: QN Operational Corpus · loaded in
        this browser · not combined with the semantic layer. Method:{" "}
        {analysis.method.ranking}; top band ={" "}
        {analysis.method.top_band} per axis.
      </div>
    </div>
  );
}

function OperationalFinding({
  row,
  whyItMatters,
}: {
  row: OperationalSignalRow;
  whyItMatters: string;
}) {
  return (
    <li className="rounded border border-ink-200 p-2.5 text-sm">
      <div className="font-semibold text-pep-900">{row.ag_name}</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">
            Incidents
          </div>
          <div className="text-sm font-semibold text-pep-900">
            {row.has_incidents
              ? row.incidents.toLocaleString("en-US")
              : "not present"}
          </div>
          {row.rank_incidents != null && (
            <div className="text-[10px] text-ink-500">
              rank #{row.rank_incidents}
              {row.share_incidents != null &&
                ` · ${(row.share_incidents * 100).toFixed(1)}% of population`}
            </div>
          )}
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">
            Alerts
          </div>
          <div className="text-sm font-semibold text-pep-900">
            {row.has_alerts
              ? row.alerts.toLocaleString("en-US")
              : "not present"}
          </div>
          {row.rank_alerts != null && (
            <div className="text-[10px] text-ink-500">
              rank #{row.rank_alerts}
              {row.share_alerts != null &&
                ` · ${(row.share_alerts * 100).toFixed(1)}% of population`}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">
          Why it matters
        </div>
        <p className="mt-0.5 text-ink-900">{whyItMatters}</p>
      </div>
    </li>
  );
}

/* ------------------------------ small pieces ------------------------------ */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        {title}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink-100 py-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </div>
      <div className="text-sm font-semibold text-pep-900">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-ink-200 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold text-pep-900">{value}</div>
    </div>
  );
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}
