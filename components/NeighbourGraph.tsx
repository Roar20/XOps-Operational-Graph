"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { GraphEdge, GraphNode, Neighbourhood } from "@/lib/data";
import { CHART, INK, PEP, STATUS, WHITE, onFill } from "@/lib/palette";

/* Grafo de vecindad en SVG plano. Sin libreria de layout: las posiciones son
   deterministas (tres columnas, reparto uniforme en vertical), de modo que la
   misma seleccion se dibuja siempre igual y se puede leer en una proyeccion.
   Una simulacion de fuerzas daria una imagen distinta en cada carga y eso, en
   una sala de juntas, se lee como si el dato hubiera cambiado. */

const NODE_W = 300;
const GUTTER = 130;
const ROW_H = 30;
const PAD_TOP = 34;
const PAD_X = 12;
/* Ancho de caracter aproximado a 11px y a 9.5px. Se usa para recortar el
   rotulo de modo que nunca se encime con el meta de la derecha. */
const CH_LABEL = 7.0;
const CH_META = 5.6;

const FILL: Record<GraphNode["kind"], string> = {
  platform: PEP[900],
  application: PEP[700],
  assignment_group: PEP[400],
};
/* El titulo de cada columna se deduce del tipo de nodo que contiene, porque el
   significado de la columna cambia con el foco: con una plataforma en el centro,
   la columna izquierda son aplicaciones, no plataformas. */
const KIND_TITLE: Record<GraphNode["kind"], string> = {
  platform: "Platforms",
  application: "Applications",
  assignment_group: "Assignment Groups",
};

function layout(n: Neighbourhood) {
  const cols: GraphNode[][] = [[], [], []];
  for (const node of n.nodes) cols[node.column].push(node);

  /* Solo se reservan las columnas que tienen nodos. Una columna vacia es un
     hueco declarado del modelo, no un carril en blanco que empuja el grafo
     hacia un lado de la pantalla. */
  const used = [0, 1, 2].filter((i) => cols[i].length > 0);
  const x = new Map<number, number>();
  used.forEach((c, i) => x.set(c, PAD_X + i * (NODE_W + GUTTER)));
  const width = PAD_X * 2 + used.length * NODE_W + Math.max(0, used.length - 1) * GUTTER;

  const rows = Math.max(1, ...cols.map((c) => c.length));
  const height = PAD_TOP + rows * ROW_H + 20;
  const pos = new Map<string, { x: number; y: number; w: number }>();
  for (const c of used) {
    const span = height - PAD_TOP - 20;
    cols[c].forEach((node, j) => {
      const y = PAD_TOP + (cols[c].length === 1 ? span / 2 : (span * (j + 0.5)) / cols[c].length);
      pos.set(node.id, { x: x.get(c)!, y, w: NODE_W });
    });
  }
  return { pos, height, width, cols, used, x };
}

/** Recorta el rotulo al ancho realmente disponible, descontando el meta. */
function fit(label: string, w: number, meta?: string) {
  const metaW = meta ? meta.length * CH_META + 14 : 8;
  const room = Math.max(4, Math.floor((w - 16 - metaW) / CH_LABEL));
  return label.length > room ? label.slice(0, Math.max(1, room - 1)) + "\u2026" : label;
}

export function NeighbourGraph({ data }: { data: Neighbourhood }) {
  const [hover, setHover] = useState<string | null>(null);
  const { pos, height, width, cols, used, x } = useMemo(() => layout(data), [data]);

  const isDim = (id: string) => {
    if (!hover) return false;
    if (id === hover) return false;
    return !data.edges.some(
      (e) => (e.from === hover && e.to === id) || (e.to === hover && e.from === id),
    );
  };
  const edgeDim = (e: GraphEdge) => hover !== null && e.from !== hover && e.to !== hover;

  return (
    <div className="scroll-thin overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Neighbourhood of ${data.focus.label}: ${cols[0].length} platforms, ${cols[1].length} applications, ${cols[2].length} assignment groups`}
        style={{ minWidth: width }}
      >
        {used.map((i) => (
          <text key={i} x={x.get(i)} y={18} fontSize={11} fontWeight={600} fill={CHART.tick}
                letterSpacing="0.06em">
            {KIND_TITLE[cols[i][0].kind].toUpperCase()} · {cols[i].length}
          </text>
        ))}

        {/* Aristas primero, para que los nodos queden encima. */}
        {data.edges.map((e, i) => {
          const a = pos.get(e.from), b = pos.get(e.to);
          if (!a || !b) return null;
          const x1 = a.x + a.w, x2 = b.x;
          const mid = (x1 + x2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${x2} ${b.y}`}
              fill="none"
              stroke={e.evidence === "E3" ? STATUS.bad : PEP[700]}
              strokeWidth={hover && !edgeDim(e) ? 2 : 1}
              strokeOpacity={edgeDim(e) ? 0.08 : e.evidence === "E3" ? 0.45 : 0.5}
              strokeDasharray={e.evidence === "E3" ? "4 3" : undefined}
            />
          );
        })}

        {data.nodes.map((n) => {
          const p = pos.get(n.id)!;
          const dim = isDim(n.id);
          const label = fit(n.label, p.w, n.meta);
          return (
            <g
              key={n.id}
              opacity={dim ? 0.25 : 1}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
            >
              <rect
                x={p.x} y={p.y - 11} width={p.w} height={22} rx={3}
                fill={n.focus ? FILL[n.kind] : WHITE}
                stroke={FILL[n.kind]}
                strokeWidth={n.focus ? 2 : 1}
              />
              <rect x={p.x} y={p.y - 11} width={4} height={22} fill={FILL[n.kind]} />
              <text
                x={p.x + 10} y={p.y} dominantBaseline="middle" fontSize={11}
                fontWeight={n.focus ? 700 : 500}
                fill={n.focus ? onFill(FILL[n.kind]).text : INK[900]}
              >
                {label}
              </text>
              {n.meta ? (
                <text x={p.x + p.w - 8} y={p.y} textAnchor="end" dominantBaseline="middle"
                      fontSize={9.5} fill={n.focus ? onFill(FILL[n.kind]).meta : INK[400]}>
                  {n.meta}
                </text>
              ) : null}
              <title>{`${n.label} — ${n.meta ?? ""} · degree ${n.degree} in the full model`}</title>
            </g>
          );
        })}
      </svg>

      {/* Los nodos de aplicacion son navegables; el SVG no lleva enlaces para
          no depender del comportamiento de <a> dentro de <svg>. */}
      {cols.flat().some((n) => n.href) ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cols.flat().filter((n) => n.href).slice(0, 40).map((n) => (
            <Link key={n.id} href={n.href!} className="btn text-[11px]">
              {n.label.length > 40 ? n.label.slice(0, 39) + "…" : n.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
