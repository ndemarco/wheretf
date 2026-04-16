// Same-unit SI prefix parser/formatter for user-facing numeric inputs.
//
// Scope: user types a scalar value like "4.7k" in a field whose unit is
// already known (e.g. ohm). We translate prefix into a base-unit scalar.
// We do NOT convert between units (that's a separate concern for later).
//
// Design rules:
// - Always store the value in the parameter's base unit.
// - Case matters: `m` = milli, `M` = mega (standard SI).
// - `µ` and ASCII `u` both map to micro.
// - Plain numbers pass through unchanged.
// - Return null on malformed input (caller decides how to warn).

const PREFIX: Record<string, number> = {
  y: 1e-24,
  z: 1e-21,
  a: 1e-18,
  f: 1e-15,
  p: 1e-12,
  n: 1e-9,
  "µ": 1e-6,
  u: 1e-6,
  m: 1e-3,
  "": 1,
  k: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
  P: 1e15,
  E: 1e18,
  Z: 1e21,
  Y: 1e24,
};

// Display-order descending; used by formatSiValue.
const DESCENDING_PREFIXES: Array<[string, number]> = [
  ["Y", 1e24],
  ["Z", 1e21],
  ["E", 1e18],
  ["P", 1e15],
  ["T", 1e12],
  ["G", 1e9],
  ["M", 1e6],
  ["k", 1e3],
  ["", 1],
  ["m", 1e-3],
  ["µ", 1e-6],
  ["n", 1e-9],
  ["p", 1e-12],
  ["f", 1e-15],
  ["a", 1e-18],
  ["z", 1e-21],
  ["y", 1e-24],
];

/**
 * Parse a user-entered scalar with an optional SI prefix.
 *
 * Accepts: "1k", "2.2M", "470n", "10m", "5µ", "5u", " 3.14 ", "-1.5k".
 * Returns a Number in the parameter's base unit, or null if unparseable.
 * Empty string returns null (caller decides whether empty = "clear").
 */
export function parseSiValue(input: string): number | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed === "") return null;

  // Match:  optional sign, digits (with optional dot + fraction),
  // optional exponent, optional whitespace, optional single prefix char.
  const m = trimmed.match(
    /^(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*([yzafpnµumkMGTPEZY]?)$/
  );
  if (!m) return null;

  const [, numPart, prefix] = m;
  const base = Number(numPart);
  if (!Number.isFinite(base)) return null;

  const mult = PREFIX[prefix];
  if (mult === undefined) return null;

  return base * mult;
}

/**
 * Format a base-unit value using the nearest SI prefix such that the
 * leading number is in [1, 1000). Negatives and zero handled.
 *
 * `sig` controls the significant-digit count used for the number portion
 * (default 3). Always returns a string.
 */
export function formatSiValue(
  n: number,
  opts: { sig?: number } = {}
): string {
  const sig = opts.sig ?? 3;
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return "0";

  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  for (const [prefix, mult] of DESCENDING_PREFIXES) {
    if (abs >= mult) {
      const scaled = abs / mult;
      // toPrecision then trim trailing zeros for readability.
      const body = Number(scaled.toPrecision(sig)).toString();
      return `${sign}${body}${prefix}`;
    }
  }
  // Smaller than yocto — give up, use exponential.
  return n.toExponential(sig - 1);
}
