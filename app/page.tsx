import { coverage, meta, applications, computeGaps, multiAgApps, maxAgCount, UNIVERSE } from "@/lib/data";
import { CoverageCard } from "@/components/CoverageCard";
import { PortfolioTable } from "@/components/PortfolioTable";
import { InlineMetric } from "@/components/Metric";
import { Note, SectionHeader } from "@/components/SectionHeader";

export default function PortfolioHealthPage() {
  const gaps = computeGaps(applications);
  const lowAuthority = coverage.filter((c) => c.evidence_tier.includes("E3"));

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-pep-900">Portfolio Health</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-700">
            Qué está roto, a quién le pega y quién debe responder. Los cuatro eslabones de la cadena
            medidos contra el mismo universo de{" "}
            <span className="num font-semibold">{meta.universe_apps}</span> aplicaciones, al corte{" "}
            <span className="num font-semibold">{meta.as_of}</span>.
          </p>
        </div>

        <SectionHeader kicker="Cobertura de la cadena" title="Los cuatro eslabones" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {coverage.map((c) => <CoverageCard key={c.id} link={c} />)}
        </div>

        <div className="mt-3 space-y-2">
          <Note tone="warn">
            {lowAuthority.length} de los {coverage.length} eslabones se apoyan en{" "}
            <strong>E3 · hoja de cálculo, baja autoridad</strong>:{" "}
            {lowAuthority.map((c) => `${c.id} ${c.link}`).join(" · ")}. Se marcan en cada tarjeta y en
            cada cifra derivada de ellos, no al pie de la pantalla.
          </Note>
          <Note>
            La aplicación por sí sola no determina el destino del ticket:{" "}
            <InlineMetric resolved={multiAgApps} universe={UNIVERSE} /> tienen más de un Assignment
            Group y una llega a <span className="num font-semibold">{maxAgCount}</span>. Abrir la ficha
            de cualquier aplicación para ver la lista completa.
          </Note>
          <Note>
            El eslabón <strong>Dashboard → Aplicación</strong> queda fuera de v1:{" "}
            <InlineMetric resolved={meta.dashboard_link.confirmed} universe={meta.dashboard_link.workspaces} />{" "}
            workspaces confirmados sobre {meta.dashboard_link.dashboards_active.toLocaleString("es-MX")}{" "}
            dashboards activos. Los 30 primeros por consumo concentran{" "}
            <span className="num font-semibold">{meta.dashboard_link.top30_views_share_pct}%</span> de
            las vistas, por lo tanto el desbloqueo es acotado. Mientras tanto el impacto por audiencia
            no se estima.
          </Note>
        </div>
      </section>

      <PortfolioTable />
    </div>
  );
}
