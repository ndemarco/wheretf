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
 * Process a single tool call and extract location data
 */
function processToolCall(
  call: ToolCall,
  results: LocationResult[],
  resultIndexRef: { value: number }
): ModuleInfo | null {
  let moduleInfo: ModuleInfo | null = null;

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
            resultIndex: resultIndexRef.value,
            itemName: typedItem.name,
            location: typedItem.location,
            moduleName: parsed.storageModule,
            path: parsed.segments,
          });
          resultIndexRef.value++;
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

  // Handle specialist agent calls (runSearchAgent, runInventoryAgent, etc.)
  // These nest the actual tool calls inside the result
  if (call.name.startsWith('run') && call.name.endsWith('Agent')) {
    const result = call.result as { toolCalls?: ToolCall[] } | undefined;
    if (result && result.toolCalls && Array.isArray(result.toolCalls)) {
      for (const nestedCall of result.toolCalls) {
        const nestedModuleInfo = processToolCall(nestedCall, results, resultIndexRef);
        if (nestedModuleInfo) {
          moduleInfo = nestedModuleInfo;
        }
      }
    }
  }

  return moduleInfo;
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
  const resultIndexRef = { value: 0 };

  for (const call of toolCalls) {
    const callModuleInfo = processToolCall(call, results, resultIndexRef);
    if (callModuleInfo) {
      moduleInfo = callModuleInfo;
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
