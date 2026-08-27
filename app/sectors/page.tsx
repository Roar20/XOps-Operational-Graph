import Link from "next/link";
import {
  sectors, appsWithoutSector, appsWithBadSectorToken, multiSectorApps,
  applications, UNIVERSE, meta,
} from "@/lib/data";
import { InlineMetric, Metric } from "@/components/Metric";
import { Note, SectionHeader } from "@/components/SectionHeader";
import { SectorTable } from "@/components/SectorTable";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { AppLink, NotRoutableTag } from "@/components/Chips";

export const metadata = { title: "Sectors · XOps Operational Graph" };

const pairTotal = applications.reduce((n, a) => n + a.sectors.length, 0);
const dq4 = meta.data_quality_notes.find((n) => n.id === "DQ4");

export default function SectorsPage() {
  return (
    <div className="space-y-6">
      <header>
        <Link href="/" className="subtle hover:text-pep-900">← Overview</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-pep-900">Sectors</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-700">
          The portfolio seen from the business side. Sector is an N:M dimension like platform and support
          group: an application can serve several sectors at once, so these rows overlap by design.
        </p>
      </header>

      <section className="card card-pad">
        <SectionHeader kicker="How this dimension was built" title="Coverage of the sector link">
          <EvidenceBadge tier="E3" showAuthority />
        </SectionHeader>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Applications with a recognised sector"
                  resolved={UNIVERSE - appsWithoutSector.length} universe={UNIVERSE}
                  unitLabel="placed in the business" />
          <div>
            <div className="label">Distinct sectors</div>
            <div className="num text-2xl font-semibold text-pep-900">{sectors.length}</div>
            <div className="subtle mt-0.5">from 88 raw tokens in the column</div>
          </div>
          <div>
            <div className="label">Application–sector pairs</div>
            <div className="num text-2xl font-semibold text-pep-900">{pairTotal}</div>
            <div className="subtle mt-0.5">
              over {UNIVERSE - appsWithoutSector.length} applications · not a count of applications
            </div>
          </div>
          <Metric label="Applications in more than one sector"
                  resolved={multiSectorApps} universe={UNIVERSE}
                  unitLabel="counted in several rows" tone="gap" />
        </div>
        <div className="mt-3 space-y-2">
          <Note tone="warn">
            <strong>Sector rows must never be added.</strong> The {pairTotal} pairs above sit on{" "}
            <InlineMetric resolved={UNIVERSE - appsWithoutSector.length} universe={UNIVERSE} /> applications,
            so summing the sector columns overcounts by{" "}
            <span className="num font-semibold">{pairTotal - (UNIVERSE - appsWithoutSector.length)}</span>.
            The same rule as blast radius: the union is the only valid total.
          </Note>
          <Note>
            The sector column of the inventory is free text. It mixes comma and semicolon separators and
            letter case (<span className="num">Global</span> / <span className="num">GLOBAL</span>). Both were
            normalized here, and that normalization is a derivation, not source data — hence{" "}
            <EvidenceBadge tier="E3" />.
          </Note>
        </div>
      </section>

      <section>
        <SectionHeader kicker={`${sectors.length} sectors`} title="Every sector, measured against itself" />
        <SectorTable rows={sectors} showLink={false} />
      </section>

      {/* ------------------ lo que no entra en ninguna fila ------------------ */}
      <section className="card card-pad border-ev-e2/40 bg-ev-e2/[0.05]">
        <SectionHeader kicker="Declared gap" title="Applications that appear in no sector row" />
        <p className="text-sm text-ink-700">
          <InlineMetric resolved={appsWithoutSector.length} universe={UNIVERSE} /> applications have no
          recognised sector: the cell is empty, reads <span className="num">TBD</span> or{" "}
          <span className="num">not stated</span>, or contained only an unrecognised token. They are not
          distributed across sectors and they are not dropped — they simply appear in no row above, which
          is why the sector table does not add up to the portfolio.
        </p>
        <ul className="scroll-thin mt-3 max-h-64 space-y-1 overflow-y-auto pr-1">
          {appsWithoutSector.slice(0, 60).map((a) => (
            <li key={a.app_id} className="flex flex-wrap items-center gap-2 text-xs">
              <AppLink appId={a.app_id} name={a.name} />
              <span className="subtle num">{a.sector || "empty"}</span>
              {!a.gates.routable ? <NotRoutableTag /> : null}
            </li>
          ))}
        </ul>
        {appsWithoutSector.length > 60 ? (
          <p className="subtle mt-2">
            Showing 60 of {appsWithoutSector.length}. The full list is filterable on{" "}
            <Link href="/portfolio" className="text-pep-700 underline">Portfolio Health</Link>.
          </p>
        ) : null}
      </section>

      {/* ------------------------- DQ4 · cuarentena ------------------------- */}
      <section className="card card-pad">
        <SectionHeader kicker="DQ4 · finding in the source" title={dq4?.title ?? "Quarantined tokens"} />
        <p className="text-sm leading-relaxed text-ink-700">{dq4?.detail}</p>
        <div className="mt-3 scroll-thin max-h-64 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Application</th>
                <th className="th">Token found in the sector column</th>
                <th className="th">Sectors it still declares</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {appsWithBadSectorToken.map((a) => (
                <tr key={a.app_id} className="row-hover">
                  <td className="td max-w-[320px] truncate"><AppLink appId={a.app_id} name={a.name} /></td>
                  <td className="num td text-xs text-ev-e3">{a.sector_unrecognized.join(", ")}</td>
                  <td className="td text-xs text-ink-600">
                    {a.sectors.length ? a.sectors.join(", ") : <span className="text-ink-400">none</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="subtle mt-2">
          {appsWithBadSectorToken.length} applications listed in full. They are published rather than
          cleaned away, because the fix belongs in the source inventory, not in this interface.
        </p>
      </section>
    </div>
  );
}
