"use client";
import {
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  ReferenceArea, ReferenceLine, BarChart, Bar, Legend, Cell,
} from "recharts";
import type { QualityPoint, QualityMetricKey } from "@/lib/types";

/* Paleta validada (dataviz): slot 1 azul, slot 2 naranja. */
export const S1 = "#2a78d6";
export const S2 = "#eb6834";
const GRID = "#e9edf3";
const AXIS = "#8494ac";
const INK = "#26334a";

const axisProps = {
  stroke: AXIS,
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: GRID },
} as const;

function TooltipBox({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-xs shadow-lg">
      <div className="font-semibold text-ink-900">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="mt-0.5 flex items-center gap-1.5 text-ink-700">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-mono tabular-nums font-medium text-ink-900">
            {typeof p.value === "number" ? p.value.toFixed(1) : p.value}{unit}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Serie unica: sin caja de leyenda, el titulo nombra la serie. */
export function MetricLine({
  data, metricKey, label, unit = "%", height = 150, breakPeriod, baselineFrom, baselineTo,
}: {
  data: QualityPoint[];
  metricKey: QualityMetricKey;
  label: string;
  unit?: string;
  height?: number;
  breakPeriod?: string;
  baselineFrom?: string;
  baselineTo?: string;
}) {
  const showBreak = !!breakPeriod && data.some((d) => d.period === breakPeriod);
  const showBase = !!baselineFrom && data.some((d) => d.period === baselineFrom);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 10, bottom: 4, left: -14 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="period" {...axisProps} minTickGap={28} />
          <YAxis {...axisProps} width={44} domain={[0, "auto"]} />
          {/* R8 — la ventana base arranca despues del quiebre de practica. */}
          {showBase && baselineTo ? (
            <ReferenceArea x1={baselineFrom} x2={baselineTo} fill={INK} fillOpacity={0.05}
              label={{ value: "base", position: "insideTop", fill: AXIS, fontSize: 10 }} />
          ) : null}
          {showBreak ? (
            <ReferenceLine x={breakPeriod} stroke={S2} strokeDasharray="4 3"
              label={{ value: "quiebre", position: "top", fill: S2, fontSize: 10 }} />
          ) : null}
          <Tooltip content={<TooltipBox unit={unit} />} cursor={{ stroke: AXIS, strokeDasharray: "3 3" }} />
          <Line
            type="monotone" dataKey={metricKey} name={label} stroke={S1} strokeWidth={2}
            dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Dos series: leyenda presente y etiquetas directas en las barras. */
export function CoverageCompareChart({
  data, height = 260,
}: {
  data: { link: string; aiPct: number; portfolioPct: number }[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 12, bottom: 4, left: 0 }} barGap={2}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="link" {...axisProps} interval={0} />
          <YAxis {...axisProps} width={48} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" />
          <Tooltip content={<TooltipBox unit="%" />} cursor={{ fill: GRID, fillOpacity: 0.5 }} />
          <Legend
            verticalAlign="top" align="left" height={26} iconType="square" iconSize={9}
            wrapperStyle={{ fontSize: 11, color: INK, paddingLeft: 48 }}
          />
          <Bar dataKey="aiPct" name="AI/ML (142 apps)" fill={S2} radius={[4, 4, 0, 0]}
               isAnimationActive={false}
               label={{ position: "top", fontSize: 10, fill: INK, formatter: (v: unknown) => `${Number(v).toFixed(0)}%` }} />
          <Bar dataKey="portfolioPct" name="Portafolio completo (504 apps)" fill={S1} radius={[4, 4, 0, 0]}
               isAnimationActive={false}
               label={{ position: "top", fontSize: 10, fill: INK, formatter: (v: unknown) => `${Number(v).toFixed(0)}%` }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Serie unica horizontal: sin leyenda. */
export function DecalogoChart({
  data, height = 300,
}: {
  data: { label: string; count: number; pct: number }[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 46, bottom: 4, left: 8 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" {...axisProps} />
          <YAxis type="category" dataKey="label" {...axisProps} width={168} />
          <Tooltip content={<TooltipBox unit="" />} cursor={{ fill: GRID, fillOpacity: 0.5 }} />
          <Bar dataKey="count" name="Incidentes clasificados" fill={S1} radius={[0, 4, 4, 0]}
               isAnimationActive={false}
               label={{ position: "right", fontSize: 10, fill: INK,
                        formatter: (v: unknown) => Number(v).toLocaleString("es-MX") }}>
            {data.map((d) => <Cell key={d.label} fill={S1} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
