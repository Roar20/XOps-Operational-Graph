import { coverage, meta, applications } from "@/lib/data";
import { computeGaps, multiAgCount, maxAgCount } from "@/lib/selectors";
import { CoverageCard } from "@/components/CoverageBar";
import { PortfolioTable } from "@/components/PortfolioTable";
import { InlineMetric } from "@/components/Metric";
import { ReadingNote, SectionHeader } from "@/components/SectionHeader";

export default function PortfolioHealthPage() {
  const gaps = computeGaps(applications);
  const lowAuthority = coverage.filter((c) => c.evidence_tier === "E3");

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Portfolio Health</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-600">
            Que esta roto, a quien le pega, y quien debe responder. Los cuatro eslabones del modelo semantico
            medidos contra el mismo universo de <span className="num font-medium">{meta.universe_apps}</span> aplicaciones,
            al corte <span className="num font-medium">{meta.as_of}</span>.
          </p>
        </div>

        <SectionHeader kicker="Cobertura del modelo" title="Los cuatro eslabones" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {coverage.map((c) => <CoverageCard key={c.id} link={c} />)}
        </div>

        <div className="mt-3 space-y-2">
          {/* R5 — el nivel de evidencia es un atributo del dato, marcado de forma consistente. */}
          <ReadingNote tone="warn">
            {lowAuthority.length} de los {coverage.length} eslabones son{" "}
            <strong>E3 — hoja de calculo, baja autoridad</strong>:{" "}
            {lowAuthority.map((c) => `${c.id} ${c.link}`).join(" · ")}. Se marcan en cada tarjeta y en cada
            cifra derivada de ellos, no al pie de la pantalla.
          </ReadingNote>
          {/* R4 aplicada a la diferencia entre registro y ruteo declarado. */}
          <ReadingNote>
            Registro no es ruteo. El eslabon L4 mide presencia en CMDB; la compuerta{" "}
            <strong>Ruteable</strong> exige al menos un Assignment Group declarado en el alcance, y hoy se cumple
            en <InlineMetric resolved={gaps.routable} universe={gaps.universe} />. La diferencia entre ambas cifras
            es hueco, no ruido, y se declara aqui en lugar de promediarse.
          </ReadingNote>
          <ReadingNote>
            La aplicacion por si sola no determina el destino del ticket:{" "}
            <InlineMetric resolved={multiAgCount} universe={gaps.universe} /> tienen mas de un Assignment Group,
            y una llega a <span className="num font-medium">{maxAgCount}</span>. Ver la ficha de cualquier
            aplicacion para la lista completa.
          </ReadingNote>
        </div>
      </section>

      <PortfolioTable />
    </div>
  );
}
