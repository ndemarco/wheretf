import { LocationResult, ModuleInfo } from '@/components/location';
import { parsePath } from '@/lib/pathUtils';

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

interface ExtractedLocationData {
  results: LocationResult[];
  moduleInfo: ModuleInfo | null;
}

/**
 * Extract location data from AI tool call results
 */
export function extractLocationData(toolCalls?: ToolCall[]): ExtractedLocationData {
  if (!toolCalls || toolCalls.length === 0) {
    return { results: [], moduleInfo: null };
  }

  const results: LocationResult[] = [];
  let moduleInfo: ModuleInfo | null = null;
  let resultIndex = 0;

  for (const call of toolCalls) {
    // Handle item search results
    if (call.name === 'searchItems' || call.name === 'createItem') {
      const result = call.result as unknown;
      const items = Array.isArray(result) ? result : result ? [result] : [];

      for (const item of items) {
        if (item && typeof item === 'object' && 'location' in item && 'name' in item) {
          const typedItem = item as { location: string; name: string };
          const parsed = parsePath(typedItem.location);

          if (parsed) {
            results.push({
              resultIndex,
              itemName: typedItem.name,
              location: typedItem.location,
              moduleName: parsed.module,
              path: parsed.segments,
            });
            resultIndex++;
          }
        }
      }
    }

    // Handle module search for module overview
    if (call.name === 'searchModules') {
      const result = call.result as unknown;
      const modules = Array.isArray(result) ? result : result ? [result] : [];

      // If we got exactly one module back, show its overview
      if (modules.length === 1) {
        const mod = modules[0] as {
          name: string;
          description?: string;
          dimensions: {
            label: string;
            values: string[];
            subdimensions?: Record<string, { dimensions: { label: string; values: string[] }[] }>;
          }[];
        };

        moduleInfo = {
          name: mod.name,
          description: mod.description,
          dimensions: mod.dimensions,
        };
      }
    }
  }

  return { results, moduleInfo };
}

/**
 * Parse multiple messages and combine location results
 */
export function extractLocationDataFromMessages(
  messages: { toolCalls?: ToolCall[] }[]
): ExtractedLocationData {
  // Only look at the most recent assistant message with tool calls
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      return extractLocationData(msg.toolCalls);
    }
  }

  return { results: [], moduleInfo: null };
}
