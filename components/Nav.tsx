"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/portfolio", label: "Portfolio Health" },
  { href: "/sectors", label: "Sectors" },
  { href: "/blast-radius", label: "Blast Radius" },
  { href: "/graph", label: "Relationships" },
  { href: "/quality", label: "Work Notes Quality" },
  { href: "/ai-ops", label: "AI Ops" },
  { href: "/upload", label: "Load Data" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href}
            className={`rounded px-2.5 py-1.5 text-sm font-medium transition ${
              active ? "bg-pep-900 text-white" : "text-ink-700 hover:bg-pep-100 hover:text-pep-900"
            }`}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
