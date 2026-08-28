"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchApps, platforms, computeGaps, meta } from "@/lib/data";
import { CriticalityChip, NotRoutableTag } from "./Chips";

/**
 * Paleta de comandos. Reemplaza el buscador en linea del encabezado.
 *
 * Dos razones para que sea paleta y no un input: en una sala el encabezado no
 * tiene ancho para un desplegable util, y buscar una aplicacion no es lo unico
 * que se quiere hacer con el teclado. Aqui una accion navega a una pantalla YA
 * filtrada, no solo a la pantalla.
 *
 * Las acciones de filtro viajan por query string y las lee PortfolioTable desde
 * window.location, que es la misma convencion que BlastRadius ya usa para ?p=:
 * asi una ruta preprerenderizada no necesita frontera de Suspense.
 */

type Item = {
  id: string;
  group: string;
  label: string;
  sub?: string;
  hint?: React.ReactNode;
  href: string;
};

const GAPS = computeGaps();

/* Las plataformas mas anchas primero: son las que alguien va a querer abrir. */
const TOP_PLATFORMS = [...platforms]
  .sort((a, b) => b.blast_radius_direct - a.blast_radius_direct)
  .slice(0, 8);

const ACTIONS: Item[] = [
  { id: "go-overview", group: "Go to", label: "Overview", href: "/" },
  { id: "go-portfolio", group: "Go to", label: "Portfolio Health", href: "/portfolio" },
  { id: "go-sectors", group: "Go to", label: "Sectors", href: "/sectors" },
  { id: "go-blast", group: "Go to", label: "Blast Radius", href: "/blast-radius" },
  { id: "go-graph", group: "Go to", label: "Relationships", href: "/graph" },
  { id: "go-quality", group: "Go to", label: "Work Notes Quality", href: "/quality" },
  { id: "go-aiops", group: "Go to", label: "AI Ops", href: "/ai-ops" },
  { id: "go-agent", group: "Go to", label: "Operational Agent", href: "/agent" },

  {
    id: "f-not-routable",
    group: "Filter the portfolio",
    label: "Applications with no Assignment Group",
    sub: `${GAPS.withoutAg} of ${GAPS.universe} · not routable`,
    href: "/portfolio?gate=not-routable",
  },
  {
    id: "f-not-owned",
    group: "Filter the portfolio",
    label: "Applications with an unconfirmed DPM",
    sub: `${GAPS.withoutDpm} of ${GAPS.universe} · DPM is TBD`,
    href: "/portfolio?gate=not-owned",
  },
  {
    id: "f-no-platform",
    group: "Filter the portfolio",
    label: "Applications with no platform identified",
    sub: `${GAPS.withoutPlatform} of ${GAPS.universe} · in no blast radius`,
    href: "/portfolio?gate=not-platform",
  },
  {
    id: "f-c1",
    group: "Filter the portfolio",
    label: "Most critical applications · C1",
    sub: "declared C1, never imputed",
    href: "/portfolio?criticality=C1",
  },
  {
    id: "f-undeclared",
    group: "Filter the portfolio",
    label: "Applications with no declared criticality",
    sub: `${GAPS.withoutCriticality} of ${GAPS.universe} · shown as Not declared`,
    href: "/portfolio?criticality=C-",
  },
  {
    id: "f-ai",
    group: "Filter the portfolio",
    label: "AI/ML applications only",
    sub: "the same four links, measured on the segment",
    href: "/portfolio?ai=1",
  },

  ...TOP_PLATFORMS.map((p) => ({
    id: `blast-${p.platform_id}`,
    group: "Blast radius of a platform",
    label: p.name,
    sub: `${p.blast_radius_direct} direct applications · tier ${p.tier}`,
    href: `/blast-radius?p=${encodeURIComponent(p.name)}`,
  })),
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const items = useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase();
    const apps = (s.length >= 2 ? searchApps(q, 8) : []).map<Item>((a) => ({
      id: a.app_id,
      group: "Applications",
      label: a.name,
      sub: `${a.apm || "no APM"} · ${a.app_id}`,
      hint: (
        <span className="flex items-center gap-1.5">
          <CriticalityChip value={a.criticality} />
          {!a.gates.routable ? <NotRoutableTag /> : null}
        </span>
      ),
      href: `/app/${a.app_id}`,
    }));
    const acts = s
      ? ACTIONS.filter((x) => `${x.label} ${x.sub ?? ""} ${x.group}`.toLowerCase().includes(s))
      : ACTIONS;
    return [...apps, ...acts];
  }, [q]);

  useEffect(() => setCursor(0), [q]);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
  }, []);

  const run = useCallback(
    (item: Item) => {
      close();
      router.push(item.href);
    },
    [close, router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => input.current?.focus());
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* El elemento bajo el cursor tiene que quedar a la vista cuando se navega con
     el teclado, o la seleccion se pierde debajo del borde de la lista. */
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search applications and run an action"
        className="flex w-full max-w-md items-center gap-2 rounded border border-ink-300 bg-white px-2.5 py-1.5 text-left text-sm text-ink-400 transition hover:border-pep-500"
      >
        <span aria-hidden className="text-ink-400">⌕</span>
        <span className="flex-1 truncate">Search an application or run an action…</span>
        <kbd className="rounded border border-ink-300 bg-ink-100 px-1 py-0.5 text-[10px] text-ink-500">⌘K</kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-pep-950/40 p-4 pt-[12vh]"
          onClick={close}
          role="presentation"
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-lg border border-ink-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            <div className="flex items-center gap-2.5 border-b border-ink-200 px-4">
              <span aria-hidden className="text-lg text-ink-400">⌕</span>
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { e.preventDefault(); close(); return; }
                  if (!items.length) return;
                  if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => (c + 1) % items.length); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => (c - 1 + items.length) % items.length); }
                  else if (e.key === "Enter") { e.preventDefault(); run(items[cursor]); }
                }}
                placeholder="Search an application, or type an action…"
                aria-label="Search an application, or type an action"
                role="combobox"
                aria-expanded
                aria-controls="xog-palette-list"
                className="w-full bg-transparent py-3.5 text-[15px] text-ink-900 outline-none placeholder:text-ink-400"
              />
            </div>

            <div ref={listRef} id="xog-palette-list" role="listbox" className="scroll-thin max-h-[52vh] overflow-y-auto py-1.5">
              {items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-ink-500">
                  Nothing matches “{q}”.
                </p>
              ) : (
                items.map((it, i) => {
                  const first = i === 0 || items[i - 1].group !== it.group;
                  return (
                    <div key={it.id}>
                      {first ? (
                        <div className="label px-4 pb-1 pt-2.5">{it.group}</div>
                      ) : null}
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === cursor}
                        data-active={i === cursor}
                        onMouseEnter={() => setCursor(i)}
                        onClick={() => run(it)}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                          i === cursor ? "bg-pep-100" : "hover:bg-pep-50"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink-900">{it.label}</span>
                          {it.sub ? <span className="num block truncate text-[11px] text-ink-500">{it.sub}</span> : null}
                        </span>
                        {it.hint}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-ink-200 bg-pep-50 px-4 py-2 text-[11px] text-ink-500">
              <Key k="↑ ↓">navigate</Key>
              <Key k="↵">open</Key>
              <Key k="Esc">close</Key>
              {/* La paleta tapa la barra de corte mientras esta abierta, asi que
                  la barra se repite aqui. El sello no desaparece detras de un
                  overlay: es la afirmacion que sostiene todas las cifras. */}
              <span className="num ml-auto">
                Cut-off {meta.as_of} · universe {meta.universe_apps} applications
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Key({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="rounded border border-ink-300 bg-white px-1 py-0.5 text-[10px] text-ink-600">{k}</kbd>
      {children}
    </span>
  );
}
