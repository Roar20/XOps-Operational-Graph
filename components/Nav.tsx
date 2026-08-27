"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Portfolio Health" },
  { href: "/blast-radius", label: "Blast Radius" },
  { href: "/quality", label: "Work Notes Quality" },
  { href: "/ai-ops", label: "AI Ops" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
              active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
