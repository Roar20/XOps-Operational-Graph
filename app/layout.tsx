import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { meta } from "@/lib/data";
import { Nav } from "@/components/Nav";
import { CommandPalette } from "@/components/CommandPalette";
import { CorpusProvider } from "@/lib/qn/corpus";
import { RulesPanel } from "@/components/RulesPanel";

export const metadata: Metadata = {
  title: "XOps Operational Graph · POC v1",
  description: "What is broken, who it hits, and who has to answer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CorpusProvider>
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
              <CommandPalette />
              <RulesPanel />
            </div>
          </div>

          {/* The data cut-off is permanently visible across the whole app. */}
          <div className="border-t border-pep-700 bg-pep-900 px-5 py-1.5">
            <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-pep-100">
              <span>Data cut-off <span className="num font-semibold text-white">{meta.as_of}</span></span>
              <span className="text-pep-500">·</span>
              <span>Universe <span className="num font-semibold text-white">{meta.universe_apps}</span> applications</span>
              <span className="text-pep-500">·</span>
              <span className="text-pep-100/80">
                v1 scope: impact by process and routing. No dashboard-audience impact.
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1560px] px-5 py-6">{children}</main>

        <footer className="mx-auto max-w-[1560px] px-5 pb-10 pt-2">
          <p className="subtle">
            Proof of concept with declared partial coverage. Source {meta.source_file} · cut-off {meta.as_of}.
          </p>
        </footer>
        </CorpusProvider>
      </body>
    </html>
  );
}
