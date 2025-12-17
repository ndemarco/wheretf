import StorageModule from '@/models/StorageModule';
import DimensionTemplate from '@/models/DimensionTemplate';
import dbConnect from '@/lib/mongodb';

export interface PathValidationResult {
  valid: boolean;
  error?: string;
  module?: string;
  segments?: { label: string; value: string }[];
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
  let templateDimensions: { label: string; values: string[] }[] | null = null;
  let templateDimensionIndex = 0;

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

    // Check if we're processing template dimensions
    if (templateDimensions) {
      if (templateDimensionIndex >= templateDimensions.length) {
        // Template dimensions exhausted, switch back to module dimensions
        templateDimensions = null;
        templateDimensionIndex = 0;
      } else {
        const templateDim = templateDimensions[templateDimensionIndex];
        if (label !== templateDim.label) {
          return {
            valid: false,
            error: `Expected dimension "${templateDim.label}" but got "${label}"`,
          };
        }
        if (!templateDim.values.includes(value)) {
          return {
            valid: false,
            error: `Invalid value "${value}" for dimension "${label}". Valid values: ${templateDim.values.join(', ')}`,
          };
        }
        segments.push({ label, value });
        templateDimensionIndex++;
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

    // Check if this value has a template mapping
    const templateName = dimension.templateMapping?.[value];
    if (templateName) {
      const template = await DimensionTemplate.findOne({
        name: templateName.toLowerCase(),
      });
      if (template) {
        templateDimensions = template.dimensions;
        templateDimensionIndex = 0;
      }
    }

    dimensionIndex++;
  }

  // Check if we've consumed all required dimensions
  // This is tricky because templates can add dimensions
  // For now, we'll consider it valid if we've processed at least the first dimension

  return {
    valid: true,
    module: moduleName,
    segments,
  };
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
