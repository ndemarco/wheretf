import StorageModule, { ICellGroup, ISubdimensions } from '@/models/StorageModule';
import dbConnect from '@/lib/mongodb';

export interface PathValidationResult {
  valid: boolean;
  error?: string;
  module?: string;
  segments?: { label: string; value: string }[];
  resolvedPath?: string; // If cell was merged, this is the canonical path
  merged?: boolean; // True if this path resolves to a merged cell
  cellGroup?: ICellGroup; // The cell group if merged
}

/**
 * Validate a location path against module definitions
 *
 * Path format: MODULE:dim-value:dim-value:...
 * Example: MUSE:level-3:row-2:col-5
 */
export async function validatePath(path: string): Promise<PathValidationResult> {
  await dbConnect();

  if (!path || typeof path !== 'string') {
    return { valid: false, error: 'Path is required' };
  }

  const parts = path.split(':');
  if (parts.length < 2) {
    return { valid: false, error: 'Path must have at least MODULE:dimension-value' };
  }

  const moduleName = parts[0].toUpperCase();
  const module = await StorageModule.findOne({ name: moduleName });

  if (!module) {
    return { valid: false, error: `Module "${moduleName}" not found` };
  }

  const segments: { label: string; value: string }[] = [];
  let dimensionIndex = 0;
  let subdimensions: ISubdimensions | null = null;
  let subdimensionIndex = 0;
  let currentSubdimParentValue: string | null = null; // Track which dimension value has the subdimensions

  // Process each path segment after the module name
  for (let i = 1; i < parts.length; i++) {
    const segment = parts[i];
    const dashIndex = segment.indexOf('-');

    if (dashIndex === -1) {
      return {
        valid: false,
        error: `Invalid segment "${segment}". Expected format: label-value`,
      };
    }

    const label = segment.substring(0, dashIndex);
    const value = segment.substring(dashIndex + 1);

    if (!label || !value) {
      return {
        valid: false,
        error: `Invalid segment "${segment}". Both label and value are required`,
      };
    }

    // Check if we're processing subdimensions
    if (subdimensions) {
      if (subdimensionIndex >= subdimensions.dimensions.length) {
        // Subdimensions exhausted, switch back to module dimensions
        subdimensions = null;
        subdimensionIndex = 0;
        currentSubdimParentValue = null;
      } else {
        const subdim = subdimensions.dimensions[subdimensionIndex];
        if (label !== subdim.label) {
          return {
            valid: false,
            error: `Expected dimension "${subdim.label}" but got "${label}"`,
          };
        }
        if (!subdim.values.includes(value)) {
          return {
            valid: false,
            error: `Invalid value "${value}" for dimension "${label}". Valid values: ${subdim.values.join(', ')}`,
          };
        }
        segments.push({ label, value });
        subdimensionIndex++;

        // Check for cell groups (merged cells) at the end of subdimensions
        if (subdimensionIndex >= subdimensions.dimensions.length && subdimensions.cellGroups) {
          // Build the cell address from all subdimension segments
          const subdimSegments = segments.slice(segments.length - subdimensions.dimensions.length);
          const cellAddress = subdimSegments.map((s) => `${s.label}-${s.value}`).join(':');

          // Check if this cell is part of a merged group
          const cellGroup = subdimensions.cellGroups.find((g) => g.members.includes(cellAddress));
          if (cellGroup) {
            // Build the resolved path with canonical address
            const baseSegments = segments.slice(0, segments.length - subdimensions.dimensions.length);
            const basePath = [moduleName, ...baseSegments.map((s) => `${s.label}-${s.value}`)].join(':');
            const resolvedPath = `${basePath}:${cellGroup.canonical}`;

            return {
              valid: true,
              module: moduleName,
              segments,
              resolvedPath,
              merged: true,
              cellGroup,
            };
          }
        }

        continue;
      }
    }

    // Process module dimension
    if (dimensionIndex >= module.dimensions.length) {
      return {
        valid: false,
        error: `Unexpected dimension "${label}". Path has more dimensions than module defines`,
      };
    }

    const dimension = module.dimensions[dimensionIndex];

    if (label !== dimension.label) {
      return {
        valid: false,
        error: `Expected dimension "${dimension.label}" but got "${label}"`,
      };
    }

    if (!dimension.values.includes(value)) {
      return {
        valid: false,
        error: `Invalid value "${value}" for dimension "${label}". Valid values: ${dimension.values.join(', ')}`,
      };
    }

    segments.push({ label, value });

    // Check if this value has subdimensions
    const subdims = dimension.subdimensions?.[value];
    if (subdims) {
      subdimensions = subdims;
      subdimensionIndex = 0;
      currentSubdimParentValue = value;
    }

    dimensionIndex++;
  }

  return {
    valid: true,
    module: moduleName,
    segments,
  };
}

/**
 * Resolve a path to its canonical form (handling merged cells)
 */
export async function resolvePath(path: string): Promise<string> {
  const result = await validatePath(path);
  if (!result.valid) {
    throw new Error(result.error);
  }
  return result.resolvedPath || path;
}

/**
 * Parse a location path into its components
 */
export function parsePath(path: string): {
  module: string;
  segments: { label: string; value: string }[];
} | null {
  if (!path || typeof path !== 'string') {
    return null;
  }

  const parts = path.split(':');
  if (parts.length < 2) {
    return null;
  }

  const module = parts[0].toUpperCase();
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

  return { module, segments };
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
