import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { meta } from "@/lib/data";
import { Nav } from "@/components/Nav";
import { GlobalSearch } from "@/components/GlobalSearch";
import { RulesPanel } from "@/components/RulesPanel";

export const metadata: Metadata = {
  title: "XOps Operational Graph · POC v1",
  description: "Que esta roto, a quien le pega, y quien debe responder.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-base font-semibold tracking-tight text-ink-900">XOps Operational Graph</span>
              <span className="rounded border border-ink-300 px-1 py-0.5 text-[10px] font-semibold text-ink-500">POC v1</span>
            </Link>
            <Nav />
            <div className="ml-auto flex flex-1 items-center justify-end gap-3">
              <GlobalSearch />
              <RulesPanel />
            </div>
          </div>

          {/* Criterio 6 — la fecha de corte es visible de forma permanente. */}
          <div className="border-t border-ink-200 bg-ink-900 px-5 py-1.5">
            <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-300">
              <span>
                Corte de datos <span className="num font-semibold text-white">{meta.as_of}</span>
              </span>
              <span className="text-ink-600">·</span>
              <span>
                Universo <span className="num font-semibold text-white">{meta.universe_apps}</span> aplicaciones
              </span>
              <span className="text-ink-600">·</span>
              <span className="text-ink-400">
                Alcance v1: impacto por proceso y por ruteo. Sin audiencia de usuarios ni linaje de pipelines.
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-5 py-6">{children}</main>

        <footer className="mx-auto max-w-[1500px] px-5 pb-10 pt-2">
          <p className="subtle">
            El eslabon Dashboard → Aplicacion no esta resuelto y se excluyo por decision de alcance, no por olvido.
            Corte {meta.as_of}.
          </p>
        </footer>
      </body>
    </html>
  );
}
