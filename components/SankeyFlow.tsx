"use client";
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from "recharts";
import type { SankeyNode } from "@/lib/data";
import { CHART, PEP, STATUS } from "@/lib/palette";

/* Un color por columna, de la rampa monocroma PepsiCo. La ruta de respuesta
   usa el tono neutro cuando falta el AG o el DPM: es un hueco, no una alarma,
   y no se pinta como riesgo.

   El relleno de hueco es STATUS.neutral, el token que la paleta reserva para
   "sin dato, bloqueado, no medido". Antes era ink-400 #8496A8, que contra el
   relleno de ruta separaba dE 7.9 a vision normal: la distincion que este
   codigo quiere hacer no se veia. Con neutral el par sube por encima de dE 14.

   El par pep-900 / pep-700 se queda en dE 14.0, apenas debajo del piso de 15,
   y ahi no se toca: son las dos anclas oficiales de marca. Lo que separa esas
   dos columnas es la posicion y el rotulo, no solo el color. */
export const KIND_FILL: Record<SankeyNode["kind"], string> = {
  platform: PEP[900],
  process: PEP[700],
  route: PEP[400],
};
export const GAP_FILL = STATUS.neutral;

function nodeFill(n: SankeyNode) {
  if (n.kind === "route" && (n.name.includes("No AG") || n.name.includes("TBD"))) return GAP_FILL;
  return KIND_FILL[n.kind];
}

/** Nodo con etiqueta. Recharts no rotula por defecto y un Sankey sin nombres
 *  no dice nada, asi que el rotulo se dibuja del lado que no cruza el flujo. */
function NodeShape(props: {
  x: number; y: number; width: number; height: number;
  index: number; payload: SankeyNode & { value: number }; containerWidth: number;
}) {
  const { x, y, width, height, payload, containerWidth } = props;
  const isLast = x + width + 180 > containerWidth;
  const short = payload.name.length > 34 ? payload.name.slice(0, 33) + "…" : payload.name;
  return (
    <Layer>
      <Rectangle x={x} y={y} width={width} height={height} fill={nodeFill(payload)} fillOpacity={1} />
      {height >= 9 ? (
        <text
          textAnchor={isLast ? "end" : "start"}
          x={isLast ? x - 6 : x + width + 6}
          y={y + height / 2}
          dominantBaseline="middle"
          fontSize={11}
          fill={CHART.tickStrong}
        >
          {short}
          <tspan fill={CHART.tickMuted} fontSize={10}> {payload.value}</tspan>
        </text>
      ) : null}
    </Layer>
  );
}

export function SankeyFlow({
  nodes, links, height = 620,
}: {
  nodes: SankeyNode[];
  links: { source: number; target: number; value: number }[];
  height?: number;
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={{ nodes, links }}
          nodePadding={14}
          nodeWidth={12}
          iterations={64}
          margin={{ top: 10, right: 190, bottom: 10, left: 10 }}
          link={{ stroke: PEP[700], strokeOpacity: 0.22 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          node={(p: any) => <NodeShape {...p} />}
        >
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 4, border: `1px solid ${CHART.tooltipBorder}` }}
            formatter={(v: unknown) => [`${Number(v)} platform–application links`, "Flow"]}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}
