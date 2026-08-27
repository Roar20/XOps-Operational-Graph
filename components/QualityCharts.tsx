"use client";
import {
  CartesianGrid, ComposedChart, Bar, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis, ReferenceArea, Legend,
} from "recharts";
import type { QualityPoint } from "@/types";

/* Monochrome ramp from the PepsiCo palette, validated against a white surface:
   the light end clears the 2:1 contrast floor and the lightness gap between steps
   is >= 0.06 in OKLCH. #DCE8F5 was dropped because it landed at 1.24:1. */
const C = { rail: "#93AFC9", ink: "#02355A", ref: "#8496A8", mid: "#155798" } as const;

/** Quality series. Bar = incident volume (the denominator), line = the rate.
 *  The rate is never drawn without its volume underneath. */
export function QualitySeries({
  points, metricKey, metricLabel, baselineFrom, baselineTo, unit,
}: {
  points: QualityPoint[];
  metricKey: keyof QualityPoint;
  metricLabel: string;
  baselineFrom: string;
  baselineTo: string;
  unit: "pp" | "pts";
}) {
  // The baseline window is marked on periods that exist, not on invented dates.
  const inWindow = points.filter((p) => p.period >= baselineFrom.slice(0, p.period.length) && p.period <= baselineTo.slice(0, p.period.length));
  const x1 = inWindow[0]?.period;
  const x2 = inWindow[inWindow.length - 1]?.period;

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#EAEEF2" vertical={false} />
          <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#5B7085" }} minTickGap={24} tickLine={false} axisLine={{ stroke: "#D8DFE6" }} />
          <YAxis yAxisId="vol" orientation="right" tick={{ fontSize: 10, fill: "#8496A8" }} tickLine={false} axisLine={false} width={52} />
          <YAxis yAxisId="rate" tick={{ fontSize: 10, fill: "#5B7085" }} tickLine={false} axisLine={{ stroke: "#D8DFE6" }} width={44}
                 domain={unit === "pts" ? [0, 100] : [0, 100]} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 4, border: "1px solid #D8DFE6" }}
            formatter={(v: unknown, name: unknown) =>
              name === "Incidents"
                ? [Number(v).toLocaleString("en-US"), "Incidents (denominator)"]
                : [`${Number(v).toFixed(1)} ${unit === "pts" ? "pts" : "%"}`, metricLabel]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {x1 && x2 ? (
            <ReferenceArea yAxisId="rate" x1={x1} x2={x2} fill={C.ink} fillOpacity={0.06}
                           label={{ value: "baseline", fontSize: 10, fill: "#5B7085", position: "insideTop" }} />
          ) : null}
          <Bar yAxisId="vol" dataKey="incidents" name="Incidents" fill={C.rail} isAnimationActive={false} />
          <Line yAxisId="rate" type="monotone" dataKey={metricKey as string} name={metricLabel}
                stroke={C.ink} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Distribution by Decalogue code. One colour only: this is volume, not risk. */
export function DecalogueChart({ rows }: { rows: { dcode: string; incidents: number; avg_score: number }[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="#EAEEF2" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: "#5B7085" }} tickLine={false} axisLine={{ stroke: "#D8DFE6" }} />
          <YAxis type="category" dataKey="dcode" width={120} tick={{ fontSize: 10, fill: "#33475B" }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 4, border: "1px solid #D8DFE6" }}
            formatter={(v: unknown) => [Number(v).toLocaleString("en-US"), "Incidents"]}
          />
          <Bar dataKey="incidents" fill={C.mid} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Coverage comparison between a subset and the full portfolio. Two series with
 *  different denominators: each bar carries its own in the tooltip. */
export function CoverageCompareChart({
  rows,
}: {
  rows: { link: string; subsetPct: number; portfolioPct: number; subsetLabel: string; portfolioLabel: string }[];
}) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#EAEEF2" vertical={false} />
          <XAxis dataKey="link" tick={{ fontSize: 10, fill: "#33475B" }} tickLine={false} axisLine={{ stroke: "#D8DFE6" }} interval={0} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#5B7085" }} tickLine={false} axisLine={false}
                 tickFormatter={(v: unknown) => `${Number(v)}%`} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 4, border: "1px solid #D8DFE6" }}
            formatter={(v: unknown, name: unknown, item: unknown) => {
              const p = (item as { payload?: Record<string, string> })?.payload;
              const den = name === "AI/ML" ? p?.subsetLabel : p?.portfolioLabel;
              return [`${Number(v).toFixed(1)}% · ${den ?? ""}`, String(name)];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="portfolioPct" name="Portfolio" fill={C.ref} isAnimationActive={false} />
          <Bar dataKey="subsetPct" name="AI/ML" fill={C.ink} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
