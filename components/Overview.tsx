import Link from "next/link";
import {
  applications, computeGaps, impactProfile, impactRouteCrossing, sectors, appsWithoutSector,
  appsWithBadSectorToken, multiSectorApps, quality, meta, UNIVERSE, TOTAL_AGS,
  TOTAL_DPMS, multiAgApps, maxAgCount, platforms,
} from "@/lib/data";
import { Metric, InlineMetric } from "@/components/Metric";
import { Note, SectionHeader } from "@/components/SectionHeader";
import { Trace } from "@/components/Trace";
import { ApproxTag, NotRoutableTag, TbdValue } from "@/components/Chips";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { ImpactChip } from "@/components/ImpactChip";
import { SectorTable } from "@/components/SectorTable";

/* Capa de entrada para negocio. Una pregunta por bloque, en lenguaje llano, con
   la cifra completa (R3) y un camino a la pantalla tecnica que la sostiene.
   No hay ninguna cifra nueva aqui: todas se calculan en lib/data.ts, las mismas
   que usan las demas pantallas. Lo que cambia es el orden y el vocabulario. */

const gaps = computeGaps();
const impact = impactProfile();
const cross = impactRouteCrossing();
const totalIncidents = quality.by_assignment_group.reduce((n, r) => n + r.incidents, 0);

function Answer({
  question, headline, children, href, hrefLabel, measure, source,
}: {
  question: string;
  headline: React.ReactNode;
  children: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  /** Ficha del registro 08_MEASURES, cuando la cifra tiene una. */
  measure?: string;
  /** Origen declarado cuando NO existe ficha: no se apunta a una que no le toca. */
  source?: string;
}) {
  return (
    <section className="card card-pad flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-700">{question}</h2>
        {measure ? <Trace measure={measure} /> : null}
      </div>
      <div>{headline}</div>
      <div className="text-sm leading-relaxed text-ink-700">{children}</div>
      {source ? <p className="subtle border-t border-ink-100 pt-2">{source}</p> : null}
      {href ? (
        <Link href={href} className="btn mt-auto w-fit">{hrefLabel ?? "See the detail"} →</Link>
      ) : null}
    </section>
  );
}

export function Overview() {
  const topSectors = sectors.slice(0, 6);

  return (
    <div className="space-y-8">
      {/* ---------------------------- encabezado ---------------------------- */}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-pep-900">
          BI &amp; AI/ML portfolio — where we stand
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-700">
          Three questions: <strong>what is broken, who it hits, and who has to answer.</strong> Every
          number below is shown with the total it is measured against, and carries a{" "}
          <span className="whitespace-nowrap rounded border border-ink-300 px-1 text-[10px] font-semibold text-ink-600">⌕ M00</span>{" "}
          button that opens where it comes from, how it is calculated and what it does not cover.
        </p>
        <p className="subtle mt-1">
          {UNIVERSE} applications · {platforms.length} platforms · {TOTAL_AGS} support groups ·
          data cut-off {meta.as_of}
        </p>
      </header>

      {/* ------------------------ las tres preguntas ------------------------ */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Answer
          question="If something breaks, does the ticket reach a team?"
          measure="M07"
          headline={
            <Metric label="Applications with a support group"
                    resolved={gaps.routable} universe={gaps.universe}
                    unitLabel="can be routed" />
          }
          href="/portfolio"
          hrefLabel="Open the full portfolio"
        >
          The rest have no support group recorded, so an incident on them has no destination. They stay
          in every list, tagged <NotRoutableTag />, rather than being hidden.
        </Answer>

        <Answer
          question="Is there a named person accountable?"
          measure="M06"
          headline={
            <Metric label="Applications with a named DPM"
                    resolved={gaps.owned} universe={gaps.universe}
                    unitLabel="have an owner" />
          }
          href="/portfolio"
          hrefLabel="Open the full portfolio"
        >
          For the remainder the owner field reads <TbdValue value={null} />. It is never filled in from
          the manager above or from the technical lead — an assumed owner is worse than a visible gap.
        </Answer>

        <Answer
          question="Do we know what it would cost the business?"
          source="Read straight from the financial_impact column of the inventory. The measure registry has no card for it: it is source data, not a computed metric."
          headline={
            <Metric label="Applications with a declared business impact"
                    resolved={impact.declared} universe={impact.universe}
                    unitLabel="have an impact level" tone="gap" />
          }
          href="#impact"
          hrefLabel="See business impact"
        >
          Business impact is only recorded for a minority of the portfolio. Nothing is inferred for the
          rest: an application with no declared impact is shown as not declared, not as low.
        </Answer>
      </div>

      {/* -------------------------- impacto de negocio -------------------------- */}
      <section id="impact" className="space-y-3">
        <SectionHeader kicker="Business impact" title="What is at stake, as far as it is recorded">
          <span className="subtle">
            Source: <span className="num">financial_impact</span> · inventory column, not a computed metric
          </span>
        </SectionHeader>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(["Critical", "High", "Medium", "Low"] as const).map((lvl) => (
            <div key={lvl} className="card card-pad">
              <ImpactChip level={lvl} />
              <div className="num mt-2 text-2xl font-semibold text-pep-900">{impact.byLevel[lvl]}</div>
              <div className="subtle num">
                of {impact.universe} · {((impact.byLevel[lvl] / impact.universe) * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>

        <Note tone="warn">
          The four levels above add up to <InlineMetric resolved={impact.declared} universe={impact.universe} />.
          The other <span className="num font-semibold">{impact.notDeclared}</span> have no impact level at
          all — of those, <span className="num font-semibold">{impact.placeholder}</span> carry a placeholder
          in the sheet such as <span className="num">TBD, ARA Not Started</span>. They are counted as not
          declared, never as Low. <strong>Do not read this as “most of the portfolio is low impact.”</strong>
        </Note>

        <div className="card card-pad border-pep-500/40">
          <SectionHeader
            kicker="The crossing that matters"
            title="How much of the routing gap can be costed?"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cell label="Impact declared · can be routed" n={cross.impactAndRoute.length}
                  universe={cross.universe}
                  note="Known cost, known destination." tone="good" />
            <Cell label="Impact declared · no route" n={cross.impactNoRoute.length}
                  universe={cross.universe}
                  note="Would be the priority list. Today it is empty." tone="bad" />
            <Cell label="No impact declared · can be routed" n={cross.noImpactWithRoute.length}
                  universe={cross.universe}
                  note="Reachable, but the business cost is unknown." />
            <Cell label="No impact declared · no route" n={cross.noImpactNoRoute.length}
                  universe={cross.universe}
                  note="Neither destination nor cost on record." tone="bad" />
          </div>
          <div className="mt-3 space-y-2">
            <Note tone="warn">
              <strong>Every one of the {gaps.withoutAg} applications with no support group also has no
              declared business impact.</strong> That is the finding: the routing gap cannot be costed at
              all today, because the two fields are missing on the same applications. The reassuring cell —{" "}
              <span className="num font-semibold">{cross.impactNoRoute.length}</span> applications with
              declared impact and no route — is empty only because impact is declared for{" "}
              <InlineMetric resolved={impact.declared} universe={impact.universe} /> of the portfolio, not
              because the exposure has been checked and found clean.
            </Note>
            <p className="subtle">
              The four cells add up to <span className="num">{cross.total}</span>, the whole portfolio: this
              is a partition, so nothing is double-counted and nothing is left out.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Audience size recorded" resolved={impact.userBaseDeclared}
                  universe={impact.universe} unitLabel="have a user-count band" compact tone="gap" />
          <Metric label="Service tier recorded" resolved={impact.serviceTierDeclared}
                  universe={impact.universe} unitLabel="Gold / Silver / Bronze" compact />
          <Metric label="Support window recorded" resolved={impact.supportWindowDeclared}
                  universe={impact.universe} unitLabel="e.g. 24*7, 16*5" compact />
        </div>
      </section>

      {/* ------------------------------ sectores ------------------------------ */}
      <section id="sectors" className="space-y-3">
        <SectionHeader
          kicker={`${sectors.length} sectors · ${multiSectorApps} applications belong to more than one`}
          title="Where the portfolio sits in the business"
        />
        <Note>
          Sector is a business dimension, not a label: an application can serve several sectors at once, so
          the sector counts below <strong>cannot be added together</strong> — {multiSectorApps} applications
          would be counted more than once. Each row is measured against its own sector.{" "}
          <EvidenceBadge tier="E3" showAuthority /> the sector column is free text and was normalized here.
        </Note>
        <SectorTable rows={topSectors} />
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/sectors" className="btn">All {sectors.length} sectors →</Link>
          <span className="subtle">
            <InlineMetric resolved={appsWithoutSector.length} universe={UNIVERSE} /> have no recognised
            sector and are not shown in any sector row.
          </span>
        </div>
      </section>

      {/* -------------------------- costo de soporte -------------------------- */}
      <section className="space-y-3">
        <SectionHeader kicker="Cost of support" title="How much work the portfolio generates">
          <Trace measure="M05" />
        </SectionHeader>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card card-pad">
            <div className="label">Incidents in the measured corpus</div>
            <div className="num mt-1 text-2xl font-semibold text-pep-900">
              {totalIncidents.toLocaleString("en-US")}
            </div>
            <div className="subtle mt-0.5">
              across {quality.by_assignment_group.length} support groups
            </div>
          </div>
          <Metric label="Eligible incidents scored" resolved={quality.meta.eligible}
                  universe={quality.meta.universe_raw} unitLabel="of the raw corpus" compact />
          <Metric label="Support groups joined to the model"
                  resolved={quality.meta.join_coverage.ags_matched}
                  universe={quality.meta.join_coverage.ags_bridge}
                  unitLabel="group keys" compact tone="gap" />
          <Metric label="Applications the measurement reaches"
                  resolved={quality.meta.join_coverage.apps_reached}
                  universe={quality.meta.join_coverage.apps_universe}
                  unitLabel="through their groups" compact tone="gap" />
        </div>
        <Note>
          Ticket and incident volume is a <strong>cost</strong> figure, never a risk one. In this portfolio
          the relationship with criticality runs backwards — the least critical tier generates the most
          tickets — so ranking by volume would push attention to the wrong applications. Nothing on any
          screen colours ticket counts as a risk scale.
        </Note>
      </section>

      {/* ---------------------- lo que todavia no se responde ---------------------- */}
      <section className="space-y-3">
        <SectionHeader kicker="Known limits" title="What this cannot answer yet, and why" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Limit title="Which ticket, by number">
            The incident corpus arrives already grouped by support team, period and code — it carries no
            incident number, so no screen can open a specific ticket.{" "}
            <strong>{meta.incident_link.grain_missing}</strong> is what is missing. The join path is
            already defined ({meta.incident_link.join_path}) and the contract already types the row, so
            adding that extract lights up ticket-level drill-down without rebuilding these screens.
          </Limit>
          <Limit title="How many people are affected">
            The Dashboard → Application link is unconfirmed for{" "}
            <InlineMetric resolved={meta.dashboard_link.workspaces - meta.dashboard_link.confirmed}
                          universe={meta.dashboard_link.workspaces} /> workspaces, and audience depends on
            it. The top 30 by usage carry {meta.dashboard_link.top30_views_share_pct}% of all views, so the
            work to unblock it is bounded and known.
          </Limit>
          <Limit title="Which team owns a given ticket">
            <InlineMetric resolved={multiAgApps} universe={UNIVERSE} /> applications have more than one
            support group and one has {maxAgCount}. The model has no field that chooses between them, so
            every screen lists all of them instead of picking one.
          </Limit>
        </div>
        <Note tone="warn">
          Quality figures are measured per support group, never per application{" "}
          <ApproxTag>approximation via groups</ApproxTag> — one group serves many applications, so its
          documentation score is not attributable to any single one. Every screen that shows it says so.
        </Note>
      </section>

      {/* ------------------------------ glosario ------------------------------ */}
      <section>
        <SectionHeader kicker="Plain language" title="The five words this model uses" />
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Term term="Business application">
            The backbone of the model. Process, sector, criticality and business impact all hang off it.
          </Term>
          <Term term="Assignment group">
            The support team a ticket is routed to in ServiceNow. Called “support group” on this screen.
          </Term>
          <Term term="DPM">
            The person accountable for the application — the one to notify when it goes down.
          </Term>
          <Term term="Blast radius">
            Everything that falls with a platform: applications, and through them business processes and
            sectors. Never added across platforms; applications that run on two are counted once.
          </Term>
          <Term term="Evidence tier">
            Where a fact came from: <EvidenceBadge tier="E1" /> the CMDB, <EvidenceBadge tier="E2" /> a
            derived analysis, <EvidenceBadge tier="E3" /> a spreadsheet. It travels with the number.
          </Term>
          <Term term="Provisional">
            Computed and reproducible, but not certified. Certification is a governance decision; this
            model does not claim it for anything.
          </Term>
        </dl>
      </section>
    </div>
  );
}

function Cell({ label, n, universe, note, tone = "neutral" }: {
  label: string; n: number; universe: number; note: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const tint = tone === "good" ? "border-good/40" : tone === "bad" ? "border-bad/40" : "border-ink-200";
  return (
    <div className={`rounded border ${tint} bg-white p-3`}>
      <div className="label">{label}</div>
      <div className="num mt-1 text-2xl font-semibold text-pep-900">{n}</div>
      <div className="subtle num">of {universe} · {((n / universe) * 100).toFixed(1)}%</div>
      <p className="subtle mt-1.5">{note}</p>
    </div>
  );
}

function Limit({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card card-pad">
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-700">{children}</p>
    </div>
  );
}

function Term({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-ink-200 bg-white p-3">
      <dt className="text-sm font-semibold text-pep-900">{term}</dt>
      <dd className="mt-0.5 text-xs leading-relaxed text-ink-700">{children}</dd>
    </div>
  );
}
