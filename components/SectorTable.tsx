import Link from "next/link";
import type { Sector } from "@/types";
import { InlineMetric } from "@/components/Metric";
import { TableCaption } from "@/components/SectionHeader";

/* Una fila por sector, cada una medida contra su propio universo. Las columnas
   son proporciones, nunca conteos comparables entre filas: una aplicacion en
   tres sectores aparece en las tres. */
export function SectorTable({ rows, showLink = true }: { rows: Sector[]; showLink?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.apps));
  return (
    <div className="card scroll-thin overflow-x-auto">
      <table className="w-full border-collapse">
        <TableCaption>
          Every rate is measured against the <span className="num">Applications</span> column of its own
          row, which is that sector&rsquo;s own universe. Rows overlap and must not be added.
        </TableCaption>
        <thead className="border-b border-ink-200 bg-pep-50">
          <tr>
            <th className="th">Sector</th>
            <th className="th">Applications</th>
            <th className="th">Can be routed</th>
            <th className="th">Has an owner</th>
            <th className="th">Business impact declared</th>
            <th className="th text-right">High or Critical</th>
            <th className="th text-right">AI/ML</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((r) => (
            <tr key={r.sector_id} className="row-hover">
              <td className="td font-medium">
                {showLink ? (
                  <Link href={`/sectors#${r.name}`} className="text-pep-700 hover:underline">{r.name}</Link>
                ) : r.name}
              </td>
              <td className="td">
                <span className="flex items-center gap-2">
                  <span className="num w-10 text-right">{r.apps}</span>
                  <span className="h-2 w-24 overflow-hidden rounded-full bg-ink-100">
                    <span className="block h-full rounded-full bg-pep-700"
                          style={{ width: `${(r.apps / max) * 100}%` }} />
                  </span>
                </span>
              </td>
              <td className="td"><InlineMetric resolved={r.routable} universe={r.apps} /></td>
              <td className="td"><InlineMetric resolved={r.owned} universe={r.apps} /></td>
              <td className="td"><InlineMetric resolved={r.impact_declared} universe={r.apps} /></td>
              <td className="num td text-right">{r.impact_high}</td>
              <td className="num td text-right">{r.ai_ml}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
