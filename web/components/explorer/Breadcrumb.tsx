'use client';

export interface BreadcrumbSegment {
  label: string;
  id?: string;
}

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
  onNavigate: (depth: number) => void;
}

export function Breadcrumb({ segments, onNavigate }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm min-w-0">
      <button
        onClick={() => onNavigate(0)}
        className={`shrink-0 ${
          segments.length === 0
            ? 'font-semibold text-gray-900 dark:text-gray-100'
            : 'text-gray-500 dark:text-gray-400 hover:text-accent-500'
        }`}
      >
        All Modules
      </button>
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1.5 min-w-0">
          <span className="text-gray-300 dark:text-gray-600 shrink-0">/</span>
          <button
            onClick={() => onNavigate(i + 1)}
            className={`truncate ${
              i === segments.length - 1
                ? 'font-semibold text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-accent-500'
            }`}
          >
            {seg.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
