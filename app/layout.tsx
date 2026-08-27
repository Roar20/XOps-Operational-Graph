import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { meta } from "@/lib/data";
import { Nav } from "@/components/Nav";
import { GlobalSearch } from "@/components/GlobalSearch";
import { RulesPanel } from "@/components/RulesPanel";

export const metadata: Metadata = {
  title: "XOps Operational Graph · POC v1",
  description: "Qué está roto, a quién le pega y quién debe responder.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-base font-semibold tracking-tight text-pep-900">
                XOps Operational Graph
              </span>
              <span className="rounded border border-ink-300 px-1 py-0.5 text-[10px] font-semibold text-ink-500">
                {meta.version}
              </span>
            </Link>
            <Nav />
            <div className="ml-auto flex flex-1 items-center justify-end gap-3">
              <GlobalSearch />
              <RulesPanel />
            </div>
          </div>

          {/* La fecha de corte es visible de forma permanente en toda la app. */}
          <div className="border-t border-pep-700 bg-pep-900 px-5 py-1.5">
            <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-pep-100">
              <span>Corte de datos <span className="num font-semibold text-white">{meta.as_of}</span></span>
              <span className="text-pep-500">·</span>
              <span>Universo <span className="num font-semibold text-white">{meta.universe_apps}</span> aplicaciones</span>
              <span className="text-pep-500">·</span>
              <span className="text-pep-100/80">
                Alcance v1: impacto por proceso y ruteo. Sin impacto por audiencia de dashboards.
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1560px] px-5 py-6">{children}</main>

        <footer className="mx-auto max-w-[1560px] px-5 pb-10 pt-2">
          <p className="subtle">
            Prueba de concepto con cobertura parcial declarada. Fuente {meta.source_file} · corte {meta.as_of}.
          </p>
        </footer>
      </body>
    </html>
  );
}
