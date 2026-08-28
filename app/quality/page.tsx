import { CorpusAnalysis } from "@/components/CorpusAnalysis";
import { QualityModule } from "@/components/QualityModule";

export const metadata = { title: "Work Notes Quality · XOps Operational Graph" };

/* Dos fuentes, una escalera de autoridad, no dos caminos.
   Arriba: el libro cargado en este navegador, que es la fuente de verdad para
   todo lo que sabe responder. Abajo: la proyeccion QN que la capa semantica
   trae embebida, que sigue siendo la unica que puede responder la serie
   temporal y las firmas recurrentes a escala de poblacion, porque el libro no
   trae hoja temporal y su Short Description solo existe en el detalle
   muestreado. Cada bloque declara de donde sale. */
export default function QualityPage() {
  return (
    <div className="space-y-10">
      <CorpusAnalysis />
      <div className="border-t border-ink-200 pt-8">
        <QualityModule />
      </div>
    </div>
  );
}
