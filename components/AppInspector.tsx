"use client";
import Link from "next/link";
import { agsOf, platformsOf, isTbd } from "@/lib/data";
import type { Application } from "@/types";
import { AiTag, CriticalityChip, GateChips, NotRoutableTag, SupportLoad, TbdValue } from "./Chips";
import { EvidenceBadge } from "./EvidenceBadge";
import { ImpactChip } from "./ImpactChip";
import { Drawer } from "./Drawer";

/**
 * Inspeccion rapida de una aplicacion dentro del drawer.
 *
 * Es un subconjunto de /app/[app_id], nunca una version distinta: lo que no
 * cabe aqui se enlaza, no se resume de otra manera. Un resumen que afirme algo
 * que la ficha completa no dice seria una segunda fuente de verdad, que es
 * exactamente lo que este proyecto no publica.
 */
export function AppInspector({ app, onClose }: { app: Application | null; onClose: () => void }) {
  if (!app) return null;

  const plats = platformsOf(app);
  const ags = agsOf(app);

  return (
    <Drawer
      open={!!app}
      onClose={onClose}
      kicker={<span className="num">{app.app_id} · {app.apm || "no APM"}</span>}
      title={app.name}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/app/${app.app_id}`} className="btn btn-active">Open the full record</Link>
          {plats.length > 0 ? (
            <Link href={`/blast-radius?p=${encodeURIComponent(plats[0].name)}`} className="btn">
              Blast radius of {plats[0].name}
            </Link>
          ) : null}
          <Link href="/graph" className="btn">See it in the graph</Link>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <CriticalityChip value={app.criticality} withLabel />
          <ImpactChip level={app.business_impact.financial} />
          {app.is_ai_ml ? <AiTag /> : null}
          {!app.gates.routable ? <NotRoutableTag /> : null}
        </div>

        <Grid>
          <Field label="Business process"><TbdValue value={app.process} /></Field>
          <Field label="Sector"><TbdValue value={app.sector} /></Field>
          <Field label="DPM"><TbdValue value={app.dpm} /></Field>
          <Field label="Scope status">{app.scope_status || <span className="subtle italic">not captured</span>}</Field>
        </Grid>

        <div>
          <div className="label mb-1.5">Gates</div>
          <GateChips gates={app.gates} />
          <p className="subtle mt-1.5">
            A closed gate is shown, never filtered out of the list.
          </p>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="label">Platforms · {plats.length}</span>
            {app.platform_evidence_tier ? <EvidenceBadge tier={app.platform_evidence_tier} /> : null}
          </div>
          {plats.length === 0 ? (
            <p className="subtle mt-1">
              No platform identified. This application appears in no blast radius, and it still counts
              towards the gap.
            </p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {plats.map((p) => (
                <li key={p.platform_id} className="rounded border border-ink-200 px-2.5 py-1.5">
                  <Link href={`/blast-radius?p=${encodeURIComponent(p.name)}`}
                        className="text-sm font-medium text-pep-700 hover:underline">
                    {p.name}
                  </Link>
                  <span className="subtle num"> · tier {p.tier} · {p.blast_radius_direct} direct apps</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="label">Assignment groups · {ags.length}</span>
            {app.ag_evidence_tier ? <EvidenceBadge tier={app.ag_evidence_tier} /> : null}
          </div>
          {ags.length === 0 ? (
            <p className="subtle mt-1">
              No Assignment Group. The application alone does not determine where a ticket goes.
            </p>
          ) : (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {ags.slice(0, 14).map((g) => (
                <li key={g.ag_id} className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-[11px] text-ink-700">
                  {g.name}
                </li>
              ))}
              {ags.length > 14 ? <li className="subtle self-center">+{ags.length - 14} more</li> : null}
            </ul>
          )}
        </div>

        <div>
          <div className="label mb-1">Support load</div>
          <SupportLoad value={app.tickets_2024} showLabel />
          <p className="subtle mt-1">
            <span className="num">tickets_2024</span> is a cost axis, not a risk axis. It is neither
            colour-coded nor ranked next to criticality.
          </p>
        </div>

        {/* R6 · lo que no se puede responder para ESTA fila se declara aqui,
            no se omite para que la tarjeta se vea completa. */}
        <div className="rounded-md border border-ev-e2/40 bg-ev-e2/[0.06] p-3">
          <div className="label mb-1">What this card cannot answer</div>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-ink-700">
            <li>Per-application incident history: no incident number reaches this model.</li>
            <li>Time to resolve: the corpus carries <span className="num">Closed At</span> only.</li>
            {isTbd(app.dpm) ? <li>Who answers for it: the DPM is unconfirmed.</li> : null}
            {ags.length === 0 ? <li>Where its tickets go: it has no Assignment Group.</li> : null}
            {app.criticality === "C-" ? <li>How critical it is: not declared, and not imputed.</li> : null}
          </ul>
        </div>
      </div>
    </Drawer>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-ink-900">{children}</dd>
    </div>
  );
}
