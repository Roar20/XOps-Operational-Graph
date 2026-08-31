import Link from "next/link";
import { notFound } from "next/navigation";
import {
  applications, getApp, meta, agsOf, platformsOf, qualityOfAgs,
  multiAgApps, maxAgCount, UNIVERSE, quality, isTbd, computeGaps,
  neighbourhood,
} from "@/lib/data";
import { NeighbourGraph } from "@/components/NeighbourGraph";
import { AiTag, ApproxTag, CriticalityChip, GateChips, NotRoutableTag, SupportLoad, TbdValue } from "@/components/Chips";
import { ImpactChip } from "@/components/ImpactChip";
import { InlineMetric, Metric } from "@/components/Metric";
import { Note, SectionHeader, TableCaption } from "@/components/SectionHeader";
import { EvidenceBadge } from "@/components/EvidenceBadge";

/** Gaps are recomputed from the data; no figure on this screen is hand-written. */
const GAPS = computeGaps();

export function generateStaticParams() {
  return applications.map((a) => ({ app_id: a.app_id }));
}

export async function generateMetadata({ params }: { params: Promise<{ app_id: string }> }) {
  const { app_id } = await params;
  const app = getApp(app_id);
  return { title: app ? `${app.name} · XOps Operational Graph` : "Application not found" };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">{children}</dd>
      {hint ? <p className="subtle mt-0.5">{hint}</p> : null}
    </div>
  );
}

/** Inventory fields that arrive empty are shown empty; they are never filled in. */
function Raw({ value }: { value: string | null | undefined }) {
  if (!value || !value.trim()) return <span className="subtle italic">not captured</span>;
  return <span>{value}</span>;
}

export default async function AppResolverPage({ params }: { params: Promise<{ app_id: string }> }) {
  const { app_id } = await params;
  const app = getApp(app_id);
  if (!app) notFound();

  const ags = agsOf(app);
  const plats = platformsOf(app);
  const q = qualityOfAgs(app.ags);
  const bi = app.business_impact;
  const agSourceLabel = app.ag_source_kind === "bridge"
    ? "the Application → Assignment Group bridge (complete list)"
    : app.ag_source_kind === "inventory"
      ? "the inventory’s Assignment Group column (capped at 10 entries)"
      : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="subtle hover:text-pep-900">← Portfolio Health</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-pep-900">{app.name}</h1>
          {app.is_ai_ml ? <AiTag /> : null}
          <CriticalityChip value={app.criticality} withLabel />
          {app.ags.length === 0 ? <NotRoutableTag /> : null}
        </div>
        <p className="num subtle mt-1">{app.apm} · {app.app_id} · {app.scope_status || "no scope status"}</p>
      </div>

      {/* ---------------- 1 identity · 2 attribution · 3 ownership ---------------- */}
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad">
          <SectionHeader title="Identity" kicker="Block 1" />
          <dl className="space-y-3">
            <Field label="Name">{app.name}</Field>
            <Field label="APM"><span className="num">{app.apm}</span></Field>
            <Field label="Category"><Raw value={app.category} /></Field>
            <Field label="Scope status"><Raw value={app.scope_status} /></Field>
            <Field label="Programme"><Raw value={app.program} /></Field>
            <Field label="Archetype"><Raw value={app.archetype} /></Field>
            <Field label="AI/ML segment">{app.is_ai_ml ? "Yes" : "No"}</Field>
          </dl>
        </section>

        <section className="card card-pad">
          <SectionHeader title="Attribution" kicker="Block 2" />
          <dl className="space-y-3">
            <Field label="Business process"><TbdValue value={app.process} /></Field>
            <Field
              label="Sector"
              hint={app.sectors.length > 1
                ? "This application serves several sectors, so it is counted in each of their rows."
                : undefined}
            >
              {app.sectors.length === 0 ? <TbdValue value={null} /> : (
                <span className="flex flex-wrap gap-1">
                  {app.sectors.map((x) => (
                    <Link key={x} href={`/sectors#${x}`}
                          className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-[11px] hover:border-pep-500 hover:text-pep-700">
                      {x}
                    </Link>
                  ))}
                </span>
              )}
            </Field>
            {/* DQ4 · el token no reconocido se muestra, no se borra. */}
            {app.sector_unrecognized.length > 0 ? (
              <Field
                label="Unrecognised token in the sector column"
                hint="It matches the ServiceNow service-ID pattern, not a sector, so it is quarantined rather than counted. See DQ4."
              >
                <span className="num rounded border border-ev-e3/40 bg-ev-e3/10 px-1.5 py-0.5 text-xs text-ev-e3">
                  {app.sector_unrecognized.join(", ")}
                </span>
              </Field>
            ) : null}
            <Field label="Raw sector cell" hint="Kept verbatim, before normalization.">
              <span className="num text-xs text-ink-600">{app.sector || "empty"}</span>
            </Field>
            <Field label="Normalized criticality"><CriticalityChip value={app.criticality} withLabel /></Field>
            {/* R7 · normalization does not erase the source vocabulary: both are still in circulation. */}
            <Field
              label="Source criticality (criticality_raw)"
              hint="The BC1–BC3 and RP1–RP3 vocabularies are both still in circulation; the normalization to C1–C3 is derived."
            >
              {app.criticality_raw?.trim()
                ? <span className="num rounded border border-ink-300 bg-ink-50 px-1.5 py-0.5 text-xs">{app.criticality_raw}</span>
                : <TbdValue value={null} />}
            </Field>
            <Field label="Criticality weight" hint={meta.criticality_scale[app.criticality] ?? undefined}>
              <span className="num">{app.criticality_weight}</span>
            </Field>
            <Field label="Gates"><GateChips gates={app.gates} /></Field>
          </dl>
        </section>

        <section className="card card-pad">
          <SectionHeader title="Ownership" kicker="Block 3" />
          <dl className="space-y-3">
            <Field label="DPM"><TbdValue value={app.dpm} /></Field>
            <Field label="DPM L3"><TbdValue value={app.dpm_l3} /></Field>
            <Field label="Owner"><TbdValue value={app.owner} /></Field>
            <Field label="Tech lead"><TbdValue value={app.tech_lead} /></Field>
            <Field label="Service tier"><Raw value={app.service_tier} /></Field>
            <Field label="Support window"><Raw value={app.support_window} /></Field>
            {/* Impacto de negocio: nivel declarado o ausencia explicita, nunca Low por omision. */}
            <Field
              label="Business impact"
              hint={bi.financial
                ? "Declared in the inventory."
                : "Not declared. An application without a level is not a low-impact application."}
            >
              <span className="flex flex-wrap items-center gap-1.5">
                <ImpactChip level={bi.financial} />
                {bi.financial_raw && !bi.financial ? (
                  <span className="num text-[11px] text-ink-500">sheet says “{bi.financial_raw}”</span>
                ) : null}
              </span>
            </Field>
            <Field label="Audience size" hint="Band recorded in the inventory, not a measured user count.">
              {bi.user_base
                ? <span className="num">{bi.user_base} users</span>
                : <TbdValue value={null} />}
            </Field>
            {/* R5 · tickets are a cost axis, never a risk axis: a single colour. */}
            <Field label="Support load (2024 tickets)" hint="A cost axis. It is not a risk signal and is not coloured as one.">
              {app.tickets_2024 === null
                ? <TbdValue value={null} />
                : <SupportLoad value={app.tickets_2024} showLabel />}
            </Field>
            <Field label="Declared reports">
              {app.declared_reports === null ? <TbdValue value={null} /> : <span className="num">{app.declared_reports}</span>}
            </Field>
          </dl>
        </section>
      </div>

      {/* ---------------- platforms: the derivation stays visible ---------------- */}
      <section className="card card-pad">
        <SectionHeader
          kicker={`${plats.length} platform${plats.length === 1 ? "" : "s"}`}
          title="Platforms it runs on"
        >
          {app.platform_evidence_tier ? <EvidenceBadge tier={app.platform_evidence_tier} showAuthority /> : null}
        </SectionHeader>

        {plats.length === 0 ? (
          <Note tone="warn">
            No platform identified. The Platform → Application link is unresolved for this application, so it
            appears in no blast radius. It stays in the list and it counts towards the gap:{" "}
            <InlineMetric resolved={GAPS.withoutPlatform} universe={GAPS.universe} /> of the applications are in
            the same situation.
          </Note>
        ) : (
          <>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {plats.map((p) => (
                <li key={p.platform_id} className="rounded border border-ink-200 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link href={`/blast-radius?p=${encodeURIComponent(p.name)}`} className="text-sm font-medium text-pep-700 hover:underline">
                      {p.name}
                    </Link>
                    {p.is_ai_platform ? <AiTag /> : null}
                    {p.is_legacy ? <span className="rounded border border-ink-300 bg-ink-50 px-1 py-0.5 text-[10px] text-ink-500">legacy</span> : null}
                  </div>
                  <div className="subtle num">
                    tier {p.tier} · {p.blast_radius_direct} direct apps · {p.routable_pct.toFixed(1)}% routable
                  </div>
                </li>
              ))}
            </ul>

            {/* R7 · a derivation never disguises itself as source data. */}
            <div className="mt-3 rounded-md border border-ink-200 bg-ink-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="label">Origin of the classification</span>
                {app.platform_evidence_tier ? <EvidenceBadge tier={app.platform_evidence_tier} /> : null}
                <span className="text-xs text-ink-700">
                  {app.platform_evidence_tier ? meta.link_sources.platform[app.platform_evidence_tier] : null}
                </span>
              </div>
              {app.platform_evidence_tier === "E3" ? (
                <p className="mt-1 text-xs text-ink-600">
                  This assignment was derived by normalizing free text. It does not carry the same authority as
                  platforms coming from the Tech Buckets analysis (E2). The original string is kept below.
                </p>
              ) : (
                <p className="mt-1 text-xs text-ink-600">
                  It comes from the Tech Buckets analysis, not from free-text normalization.
                </p>
              )}
              {app.technology_raw ? (
                <>
                  <div className="label mt-2">technology_raw · original string, untransformed</div>
                  <pre className="num mt-1 overflow-x-auto whitespace-pre-wrap rounded border border-ink-200 bg-white px-2 py-1.5 text-xs text-ink-800">{app.technology_raw}</pre>
                </>
              ) : (
                <p className="subtle mt-2">No <span className="num">technology_raw</span>: the inventory did not capture a Technology Stack for this application.</p>
              )}
            </div>
          </>
        )}
      </section>

      {/* ---------------- 4 operation · the point of this screen ---------------- */}
      <section className="card card-pad">
        <SectionHeader
          kicker={`Block 4 · ${ags.length} assignment group${ags.length === 1 ? "" : "s"}`}
          title="Operation — every Assignment Group"
        >
          {app.ag_evidence_tier ? <EvidenceBadge tier={app.ag_evidence_tier} showAuthority /> : null}
        </SectionHeader>

        <Note tone={ags.length === 0 ? "warn" : "neutral"}>
          {ags.length === 0 ? (
            <>
              This application <strong>has no declared Assignment Group</strong>. An incident on it finds no
              destination. It stays in the inventory and it counts towards the routing gap:{" "}
              <InlineMetric resolved={GAPS.withoutAg} universe={GAPS.universe} /> of the applications are in the
              same situation.
            </>
          ) : (
            <>
              The application on its own <strong>does not determine where the ticket goes</strong>. It runs on{" "}
              <span className="num font-semibold">{ags.length}</span> assignment group{ags.length === 1 ? "" : "s"}
              {" "}and <strong>all of them</strong> are listed, without picking one as “the” owner: resolving the
              destination needs an extra discriminator (subservice, symptom or CI) that this model does not carry.
              Across the portfolio, <InlineMetric resolved={multiAgApps} universe={UNIVERSE} /> have more than one
              and one reaches <span className="num font-semibold">{maxAgCount}</span>.
            </>
          )}
        </Note>

        {ags.length > 0 ? (
          <>
            <div className="mt-3 scroll-thin overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-ink-200 bg-ink-50">
                  <tr>
                    <th className="th w-8">#</th>
                    <th className="th">Assignment Group</th>
                    <th className="th">Clave</th>
                    <th className="th text-right">Apps in the group</th>
                    <th className="th">Processes it covers</th>
                    <th className="th">DPMs</th>
                    <th className="th">Quality corpus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {ags.map((g, i) => (
                    <tr key={g.ag_id} className="row-hover align-top">
                      <td className="num td text-ink-400">{i + 1}</td>
                      <td className="td font-medium">{g.name}</td>
                      <td className="num td text-xs text-ink-500">{g.ag_key}</td>
                      <td className="num td text-right">{g.app_count}</td>
                      <td className="td max-w-[260px] text-xs text-ink-600">
                        {g.processes.length ? g.processes.join(", ") : <TbdValue value={null} />}
                      </td>
                      <td className="td max-w-[200px] text-xs text-ink-600">
                        {g.dpms.length ? g.dpms.join(", ") : <TbdValue value={null} />}
                      </td>
                      <td className="td text-xs">
                        {g.has_quality
                          ? <span className="text-good">measured</span>
                          : <span className="text-ink-400">no eligible corpus</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {agSourceLabel ? (
              <p className="subtle mt-2">
                List taken from {agSourceLabel}. {app.ag_evidence_tier ? meta.link_sources.assignment_group[app.ag_evidence_tier] : null}
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      {/* ---------------- quality: a declared approximation, never attributed to the app ---------------- */}
      {ags.length > 0 ? (
        <section className="card card-pad">
          <SectionHeader kicker="Work notes quality" title="Quality of the groups that serve this application">
            <ApproxTag>measured per AG, not per application</ApproxTag>
          </SectionHeader>

          <Note tone="warn">
            These figures describe the <strong>groups</strong>, not this application. An AG serves many
            applications, so its diagnostic rate is not attributable to any one of them. On top of that, only
            groups with an eligible corpus are measured:{" "}
            <InlineMetric resolved={q.measured} universe={q.total} /> of this application’s AGs have a measurement,
            and across the whole model only{" "}
            <InlineMetric resolved={quality.meta.join_coverage.ags_matched} universe={quality.meta.join_coverage.ags_bridge} />{" "}
            of the group keys could be joined to the corpus.
          </Note>

          {q.measured === 0 ? (
            <p className="mt-3 text-sm text-ink-600">
              None of this application’s {q.total} groups reaches the eligibility threshold
              ({quality.meta.eligibility_rule}). There is no measurement to show, and it is not replaced by a
              portfolio average.
            </p>
          ) : (
            <>
              <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Metric compact label="AGs with a measurement" resolved={q.measured} universe={q.total} unitLabel="of this app’s AGs" />
                <div>
                  <div className="label">Weighted diagnostic rate</div>
                  <div className="num text-lg font-semibold text-pep-900">{q.diagnostic_rate?.toFixed(1)}%</div>
                  <div className="subtle num mt-0.5">over {q.incidents.toLocaleString("en-US")} incidents from those AGs</div>
                </div>
                <div>
                  <div className="label">With root cause</div>
                  <div className="num text-lg font-semibold text-pep-900">{q.has_root_rate?.toFixed(1)}%</div>
                  <div className="subtle num mt-0.5">over {q.incidents.toLocaleString("en-US")} incidents</div>
                </div>
                <div>
                  <div className="label">Poor documentation</div>
                  <div className="num text-lg font-semibold text-pep-900">{q.poor_rate?.toFixed(1)}%</div>
                  <div className="subtle num mt-0.5">over {q.incidents.toLocaleString("en-US")} incidents</div>
                </div>
              </div>

              <div className="mt-3 scroll-thin overflow-x-auto">
                <table className="w-full border-collapse">
                  <TableCaption>
                    Every rate is computed over the <span className="num">Incidents</span> column of its row,
                    which are that group’s incidents — not this application’s.
                  </TableCaption>
                  <thead className="border-b border-ink-200 bg-ink-50">
                    <tr>
                      <th className="th">Measured group</th>
                      <th className="th text-right">Incidents</th>
                      <th className="th text-right">Diagnostic rate</th>
                      <th className="th text-right">With root cause</th>
                      <th className="th text-right">QN v2.4.2 score</th>
                      <th className="th text-right">Poor docs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {q.rows.map((r) => (
                      <tr key={r.ag_key} className="row-hover">
                        <td className="td font-medium">{r.name}</td>
                        <td className="num td text-right">{r.incidents.toLocaleString("en-US")}</td>
                        <td className="num td text-right">{r.diagnostic_rate.toFixed(1)}%</td>
                        <td className="num td text-right">{r.has_root_rate.toFixed(1)}%</td>
                        <td className="num td text-right">{r.avg_score.toFixed(2)}</td>
                        <td className="num td text-right">{r.poor_rate.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : null}

      {/* ---------------- what this record cannot answer ---------------- */}
      <section className="card card-pad">
        <SectionHeader kicker="Declared limit" title="What this record does not answer" />
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">
          <li>
            <strong>How many users depend on this application.</strong> The Application → Audience link is not
            captured in v1. That is a scope decision, not an oversight.
          </li>
          <li>
            <strong>Which dashboards go down with it.</strong> The Dashboard → Application link has{" "}
            <InlineMetric resolved={meta.dashboard_link.confirmed} universe={meta.dashboard_link.workspaces} />{" "}
            workspaces confirmed. It is out of v1.
          </li>
          <li>
            <strong>Which incidents this application had, by number.</strong> {meta.incident_link.note}
          </li>
          <li>
            <strong>Which group a specific ticket goes to.</strong> Every AG is listed because the model does
            not contain the discriminator that chooses between them.
          </li>
          {isTbd(app.dpm) ? (
            <li>
              <strong>Who answers at DPM level.</strong> This application’s DPM is TBD and it is not imputed
              from the DPM L3 nor from the owner.
            </li>
          ) : null}
        </ul>
        <p className="subtle mt-3">Data cut-off {meta.as_of}. Source: {meta.source_file}.</p>
      </section>

      {/* Anchor target for "View relationship graph →" from Ask XOps.
          Reuses the existing NeighbourGraph and the semantic-layer
          neighbourhood() builder. One-hop, deterministic, no dependency
          inference. */}
      {(() => {
        const n = neighbourhood("application", app.app_id);
        if (!n) return null;
        return (
          <section id="relationship-graph" className="card card-pad">
            <SectionHeader
              kicker={`Neighbourhood of ${n.focus.label}`}
              title="Relationship graph"
            />
            <p className="subtle mb-3">{n.note}</p>
            <NeighbourGraph data={n} />
          </section>
        );
      })()}
    </div>
  );
}
