// Shared types + helpers for the taxonomy audit surface.
// Kept framework-agnostic so both server repos and client render paths
// can speak the same shape.

export type AuditSeverity = "info" | "warning" | "error";

export interface AuditSubject {
  id: string;
  name: string;
}

export interface AuditCheck {
  check: string;
  severity: AuditSeverity;
  subjects: AuditSubject[];
  suggestion: string | null;
}

/**
 * Remove duplicate {id} entries while preserving first-seen order.
 */
export function dedupe(subjects: AuditSubject[]): AuditSubject[] {
  const seen = new Set<string>();
  const out: AuditSubject[] = [];
  for (const s of subjects) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

/**
 * Jaccard similarity between two names, tokenised on non-alphanumerics.
 * Case-insensitive.
 */
export function jaccardTokens(a: string, b: string): number {
  const ta = new Set(
    a.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  );
  const tb = new Set(
    b.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  );
  if (ta.size === 0 && tb.size === 0) return 0;
  let inter = 0;
  for (const x of ta) if (tb.has(x)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}
