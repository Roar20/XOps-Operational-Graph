"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, usePathname } from "next/navigation";
import { sectors } from "@/lib/data";
import {
  buildPortfolioRiskPack,
  deriveXOpsContext,
} from "@/lib/agent/insights/portfolio-risk";
import type {
  EvidencePack,
  PortfolioRiskScope,
  StructuredAnswer,
} from "@/lib/agent/insights/types";

type Phase = "idle" | "calling" | "answered" | "error";

/**
 * Never render backend detail to the user. Every failure path funnels through
 * this table so the interface stays intentional and safe. Technical detail is
 * kept in console.warn calls at the failure site for developer diagnosis.
 */
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

/** Sorted once for the drawer's scope selector. */
const SECTORS_SORTED = [...sectors].sort((a, b) =>
  a.name.localeCompare(b.name),
);

/**
 * Trigger + Drawer + AnswerCard for the XOps Insight Agent. Global capability
 * mounted once in the layout header. Reads navigation state via next router;
 * does not own or mutate it.
 */
export function AskXOps() {
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

  const [open, setOpen] = useState(false);
  // Portal target only exists after mount on the client. Rendering the drawer
  // before mount would trigger a hydration mismatch; this flag defers it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [scope, setScope] = useState<PortfolioRiskScope>(defaultScope);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pack, setPack] = useState<EvidencePack | null>(null);
  const [answer, setAnswer] = useState<StructuredAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      // Read the body once, safely, so it is available for both the internal
      // log and the success path — but never rendered as-is to the user.
      let body: unknown = null;
      try {
        body = isJson ? await res.json() : await res.text();
      } catch {
        /* body was already consumed or unreadable */
      }

      if (!res.ok) {
        // Server details go to devtools only. UI gets a mapped, benign message.
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
      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-50 flex bg-ink-900/30"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-label="Ask XOps"
        >
          <div
            className="ml-auto h-full w-full max-w-[560px] overflow-y-auto bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-ink-200 bg-white px-4 py-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Ask XOps
                </div>
                <div className="text-xs text-ink-500">
                  Grounded on the semantic layer
                </div>
              </div>
              <button
                type="button"
                className="rounded border border-ink-300 px-2 py-1 text-xs text-ink-700 hover:bg-ink-50"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="space-y-5 p-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Scope
                </label>
                <select
                  className="w-full rounded border border-ink-300 bg-white px-2 py-1.5 text-sm"
                  value={
                    scope.kind === "ai_ml_segment" ? "__ai" : scope.sector_id
                  }
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
              </div>

              <div>
                <p className="text-sm text-ink-900">
                  Which applications need attention first, and why?
                </p>
                <button
                  type="button"
                  className="mt-2 rounded bg-pep-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-pep-800 disabled:opacity-50"
                  onClick={analyze}
                  disabled={phase === "calling"}
                >
                  {phase === "calling" ? "Analyzing…" : "Analyze"}
                </button>
              </div>

              {phase === "error" && (
                <div className="rounded border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
                  {error}
                </div>
              )}

              {phase === "answered" && answer && pack && (
                <AnswerCard answer={answer} pack={pack} />
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function AnswerCard({
  answer,
  pack,
}: {
  answer: StructuredAnswer;
  pack: EvidencePack;
}) {
  const nameById = new Map(pack.applications.map((a) => [a.app_id, a.name]));
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          Answer
        </div>
        <p className="text-sm text-ink-900">{answer.answer}</p>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          Applications requiring attention
        </div>
        <ol className="mt-1 space-y-2">
          {answer.findings.map((f, i) => (
            <li
              key={i}
              className="rounded border border-ink-200 p-2.5 text-sm"
            >
              <div className="font-semibold text-pep-900">
                {nameById.get(f.app_id) ?? f.app_id}{" "}
                <span className="text-xs font-normal text-ink-500">
                  · {f.app_id}
                </span>
              </div>
              <p className="mt-1 text-ink-900">{f.fact}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {f.signals_combined.map((s, j) => (
                  <span
                    key={j}
                    className="rounded bg-pep-100 px-1.5 py-0.5 text-[10px] font-medium text-pep-800"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          What this means
        </div>
        <p className="text-sm text-ink-900">{answer.insight}</p>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          Next step
        </div>
        <p className="text-sm text-ink-900">{answer.recommended_action}</p>
      </div>

      <div className="border-t border-ink-200 pt-2 text-xs text-ink-500">
        <div>
          Confidence: {answer.confidence}
          {answer.limitations.length > 0 &&
            ` · Limitations: ${answer.limitations.join("; ")}`}
        </div>
        <div className="mt-1">
          Cut-off {pack.metadata.as_of} · scope universe{" "}
          {pack.metadata.scope_universe} apps · top{" "}
          {pack.metadata.ranking.top_n} shown
        </div>
        <div className="mt-1 italic">{pack.metadata.ranking.disclaimer}</div>
      </div>
    </div>
  );
}
