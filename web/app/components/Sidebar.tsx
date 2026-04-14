"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = {
  href: string;
  title: string;
  icon: React.ReactNode;
};

type NavSection = {
  label: string | null;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: null, // primary workflow — no heading
    items: [
      {
        href: "/modules",
        title: "Modules",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
      {
        href: "/inserts",
        title: "Inserts",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M9 4v16M4 9h16" />
          </svg>
        ),
      },
      {
        href: "/items",
        title: "Items",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
      },
      {
        href: "/activity",
        title: "Activity",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path d="M12 8v4l3 3" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        href: "/templates",
        title: "Templates",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
        ),
      },
      {
        href: "/taxonomy",
        title: "Taxonomy",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path d="M4 6h16M4 12h10M4 18h6" />
          </svg>
        ),
      },
    ],
  },
];

const STORAGE_KEY = "wheretf.sidebar.expanded";

export default function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored != null) setExpanded(stored === "1");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
  }, [expanded, hydrated]);

  // Keyboard shortcut: Ctrl/Cmd + \
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        setExpanded((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const width = expanded ? "w-48" : "w-14";

  return (
    <nav
      className={`${width} bg-slate-800 border-r border-slate-700 flex flex-col shrink-0 transition-[width] duration-150 group/sidebar`}
    >
      {/* Header row: brand space + collapse chevron (appears on hover) */}
      <div className="h-10 flex items-center justify-end px-2 border-b border-slate-700/50 shrink-0">
        <button
          onClick={() => setExpanded((v) => !v)}
          title={`${expanded ? "Collapse" : "Expand"} sidebar (Ctrl/Cmd + \\)`}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-700/70 transition-all opacity-0 group-hover/sidebar:opacity-100 focus:opacity-100"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={`w-4 h-4 transition-transform ${
              expanded ? "" : "rotate-180"
            }`}
          >
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col flex-1 gap-4 px-2 py-3">
        {navSections.map((section, sectionIdx) => (
          <div
            key={section.label ?? `section-${sectionIdx}`}
            className="flex flex-col gap-1"
          >
            {section.label && expanded && (
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-2 pb-1">
                {section.label}
              </div>
            )}
            {section.label && !expanded && sectionIdx > 0 && (
              <div className="h-px bg-slate-700/60 mx-2 mb-1" aria-hidden />
            )}
            {section.items.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={expanded ? undefined : item.title}
                  className={`h-9 rounded-md flex items-center gap-3 transition-colors px-2 ${
                    isActive
                      ? "bg-slate-700 text-accent"
                      : "text-slate-400 hover:bg-slate-700 hover:text-accent"
                  }`}
                >
                  <span className="shrink-0 flex items-center justify-center w-6">
                    {item.icon}
                  </span>
                  {expanded && (
                    <span className="text-sm truncate">{item.title}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
