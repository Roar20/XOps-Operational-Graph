"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Panel lateral deslizante. Sirve para inspeccionar una fila o un nodo sin
 * perder la pantalla que se estaba mirando, que es el punto: en una sala, salir
 * a otra ruta y volver cuesta el hilo de la conversacion.
 *
 * No es el modal de Trace.tsx y no lo reemplaza. Trace centra un dialogo sobre
 * una sola medida y es una lectura terminal. Este entra por la derecha, deja el
 * fondo a la vista y esta pensado para saltar de una fila a otra.
 */
export function Drawer({
  open,
  onClose,
  title,
  kicker,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  kicker?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  /* La animacion necesita un frame entre montar y mover: si se monta ya en su
     posicion final no hay transicion que ver. */
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    restoreTo.current = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => setShown(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (shown) panel.current?.focus();
  }, [shown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Inspector"}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-pep-950/40 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}
      />
      <div
        ref={panel}
        tabIndex={-1}
        className={`absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-ink-200 bg-white shadow-2xl outline-none transition-transform duration-200 ease-out ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-200 bg-pep-900 px-5 py-3.5 text-white">
          <div className="min-w-0">
            {kicker ? (
              <div className="text-[11px] font-semibold uppercase tracking-wide text-pep-100">{kicker}</div>
            ) : null}
            <h2 className="truncate text-base font-semibold">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn shrink-0 border-white/30 bg-white/10 text-white hover:bg-white/20"
          >
            Close <kbd className="ml-1 text-[10px] opacity-70">Esc</kbd>
          </button>
        </header>

        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? <div className="border-t border-ink-200 bg-pep-50 px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
