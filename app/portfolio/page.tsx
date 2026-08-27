import Link from "next/link";
import { coverage, meta, applications, computeGaps, multiAgApps, maxAgCount, UNIVERSE } from "@/lib/data";
import { CoverageCard } from "@/components/CoverageCard";
import { PortfolioTable } from "@/components/PortfolioTable";
import { InlineMetric } from "@/components/Metric";
import { Note, SectionHeader } from "@/components/SectionHeader";

export const metadata = { title: "Portfolio Health · XOps Operational Graph" };

export default function PortfolioHealthPage() {
  const gaps = computeGaps(applications);
  const lowAuthority = coverage.filter((c) => c.evidence_tier.includes("E3"));

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4">
          <Link href="/" className="subtle hover:text-pep-900">← Overview</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-pep-900">Portfolio Health</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-700">
            What is broken, who it hits and who has to answer. The four links of the chain measured
            against the same universe of{" "}
            <span className="num font-semibold">{meta.universe_apps}</span> applications, at the{" "}
            <span className="num font-semibold">{meta.as_of}</span> cut-off.
          </p>
        </div>

        <SectionHeader kicker="Chain coverage" title="The four links" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {coverage.map((c) => <CoverageCard key={c.id} link={c} />)}
        </div>

        <div className="mt-3 space-y-2">
          <Note tone="warn">
            {lowAuthority.length} of the {coverage.length} links rest on{" "}
            <strong>E3 · spreadsheet, low authority</strong>:{" "}
            {lowAuthority.map((c) => `${c.id} ${c.link}`).join(" · ")}. They are marked on every card and
            on every figure derived from them, not in a footnote at the bottom of the screen.
          </Note>
          <Note>
            The application on its own does not determine where a ticket goes:{" "}
            <InlineMetric resolved={multiAgApps} universe={UNIVERSE} /> have more than one Assignment
            Group and one reaches <span className="num font-semibold">{maxAgCount}</span>. Open any
            application record to see its full list.
          </Note>
          <Note>
            The <strong>Dashboard → Application</strong> link is out of v1:{" "}
            <InlineMetric resolved={meta.dashboard_link.confirmed} universe={meta.dashboard_link.workspaces} />{" "}
            workspaces confirmed against {meta.dashboard_link.dashboards_active.toLocaleString("en-US")}{" "}
            active dashboards. The top 30 by consumption concentrate{" "}
            <span className="num font-semibold">{meta.dashboard_link.top30_views_share_pct}%</span> of all
            views, so the work to unblock it is bounded. Until then, audience impact is not estimated.
          </Note>
        </div>
      </section>

      <PortfolioTable />
    </div>
  );
}
