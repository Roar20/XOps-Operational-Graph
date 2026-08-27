"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchApps } from "@/lib/data";
import { CriticalityChip, NotRoutableTag } from "./Chips";

/** Buscador global por nombre y APM, accesible desde cualquier pantalla,
 *  con navegación por teclado (↑ ↓ Enter Esc, ⌘K para enfocar). */
export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = useMemo(() => (q.trim().length >= 2 ? searchApps(q) : []), [q]);
  useEffect(() => setCursor(0), [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); input.current?.focus(); setOpen(true);
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const go = (id: string) => { setOpen(false); setQ(""); router.push(`/app/${id}`); };

  return (
    <div ref={box} className="relative w-full max-w-md">
      <input
        ref={input}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => (c + 1) % results.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => (c - 1 + results.length) % results.length); }
          else if (e.key === "Enter") { e.preventDefault(); go(results[cursor].app_id); }
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Buscar aplicación por nombre o APM…"
        aria-label="Buscar aplicación por nombre o APM"
        role="combobox"
        aria-expanded={open}
        aria-controls="xog-search-results"
        className="input pr-12"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-ink-300 bg-ink-100 px-1 py-0.5 text-[10px] text-ink-500">
        ⌘K
      </kbd>

      {open && q.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded border border-ink-200 bg-white shadow-xl">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-ink-500">Sin coincidencias para “{q}”.</div>
          ) : (
            <ul id="xog-search-results" role="listbox" className="scroll-thin max-h-80 overflow-y-auto">
              {results.map((a, i) => (
                <li key={a.app_id} role="option" aria-selected={i === cursor}>
                  <button type="button" onMouseEnter={() => setCursor(i)} onClick={() => go(a.app_id)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left ${i === cursor ? "bg-pep-100" : "hover:bg-pep-50"}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-900">{a.name}</span>
                      <span className="num block truncate text-[11px] text-ink-500">
                        {a.apm || "sin APM"} · {a.app_id}
                      </span>
                    </span>
                    <CriticalityChip value={a.criticality} />
                    {!a.gates.routable ? <NotRoutableTag /> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
