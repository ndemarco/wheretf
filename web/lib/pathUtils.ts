/**
 * Client-safe path utilities (no mongoose/server dependencies)
 */

/**
 * Parse a location path into its components
 */
export function parsePath(path: string): {
  storageModule: string;
  segments: { label: string; value: string }[];
} | null {
  if (!path || typeof path !== 'string') {
    return null;
  }

  const parts = path.split(':');
  if (parts.length < 2) {
    return null;
  }

  const storageModule = parts[0].toUpperCase();
  const segments: { label: string; value: string }[] = [];

  for (let i = 1; i < parts.length; i++) {
    const segment = parts[i];
    const dashIndex = segment.indexOf('-');

    if (dashIndex === -1) {
      return null;
    }

    const label = segment.substring(0, dashIndex);
    const value = segment.substring(dashIndex + 1);

    if (!label || !value) {
      return null;
    }

    segments.push({ label, value });
  }

  return { storageModule, segments };
}

/**
 * Build a location path from components
 */
export function buildPath(
  module: string,
  segments: { label: string; value: string }[]
): string {
  const parts = [module.toUpperCase()];

  for (const segment of segments) {
    parts.push(`${segment.label}-${segment.value}`);
  }

  return parts.join(':');
}
