// Tool handlers — stub for Phase 2 rewrite
// Will be rebuilt against new models (Template, Module, Insert, Item, Assignment)

type ToolHandler = (args: Record<string, unknown>, userId: string) => Promise<unknown>;

const toolHandlers: Record<string, ToolHandler> = {};

export function getToolHandler(name: string): ToolHandler | undefined {
  return toolHandlers[name];
}

export default toolHandlers;
