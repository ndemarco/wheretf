import { StorageModule, Item, StorageModuleMetrics, StorageMetric, DimensionTemplate } from "@/types/storage";

/**
 * Parses a location string into a structured object.
 * Example: "MUSE:level-3:row-2:col-5" -> { module: "MUSE", level: "3", row: "2", col: "5" }
 */
export function parseLocation(location: string): Record<string, string> {
    const parts = location.split(':');
    const result: Record<string, string> = { module: parts[0] };

    for (let i = 1; i < parts.length; i++) {
        const [key, value] = parts[i].split('-');
        if (key && value) {
            result[key] = value;
        }
    }
    return result;
}

/**
 * Generates all valid paths for a given storage module.
 * This effectively calculates the "capacity" of the module (total number of slots).
 * 
 * NOTE: This is a recursive function that expands all dimensions.
 * For complex generic modules with templates, it resolves the templates.
 */
export function generateValidPaths(module: StorageModule, templates: DimensionTemplate[]): string[] {
    const paths: string[] = [];
    const templateMap = new Map(templates.map(t => [t.name, t]));

    function recurse(dimIndex: number, currentPath: string, currentTemplateName?: string) {
        // If we are inside a template (handling template dimensions)
        if (currentTemplateName) {
            const template = templateMap.get(currentTemplateName);
            if (!template) return; // Should not happen with valid data

            // The currentDimensionIndex here is relative to the template's dimensions array
            // We need to keep track of where we are in the template
            // BUT, the recursive structure of `module.dimensions` is simplistic.
            // Actually, `template` replaces the REST of the dimensions for that branch.

            // Let's simplified this: 
            // If a dimension has a template or templateMapping, it branches out.
            // Current implementation assumes module.dimensions is a flat list of potential hierarchy, 
            // but templates introduce sub-hierarchies.

            // Correction: The schema allows `template` on a dimension.
            // If `template` is present, it adds those dimensions to the path.
            // If `templateMapping` is present, it uses the mapping to find the template for the *specific value*.
        }

        // This logic is getting complex because of the schema flexibility.
        // Let's implement a simpler version first that handles the standard cases:
        // 1. Simple nested dimensions (level -> bin)
        // 2. Template mappings (level 1 -> plano 4x6)

        // ... (Refactoring logic below)
    }

    // Iterative approach might be cleaner given the dynamic nature
    // Start with ["MUSE"]
    let currentPaths = [module.name];

    for (const dim of module.dimensions) {
        const nextPaths: string[] = [];

        for (const path of currentPaths) {
            // Check if this path branch uses a specific template mapping from the PREVIOUS dimension? 
            // No, the schema defines dimensions at the top level of the module, OR inside a template.
            // Wait, `module.dimensions` is an array. 

            // If a dimension has `values`, we iterate them.
            for (const val of dim.values) {
                let pathWithVal = `${path}:${dim.label}-${val}`;

                // Does this specific value map to a template?
                let activeTemplate: DimensionTemplate | undefined;

                if (dim.template) {
                    // If the dimension *itself* has a fixed template (rare in examples, but possible)
                    // `dim.template` is an ObjectId in schema, but we expect populated or separate lookup.
                    // We'll rely on `templates` arg.
                    // In schema: `template` is a Ref.
                    // implementation: we need to match it.
                } else if (dim.templateMapping && dim.templateMapping[val]) {
                    const templateName = dim.templateMapping[val];
                    activeTemplate = templateMap.get(templateName);
                }

                if (activeTemplate) {
                    // Expand the template dimensions
                    const templatePaths = expandTemplate(pathWithVal, activeTemplate);
                    nextPaths.push(...templatePaths);
                } else {
                    nextPaths.push(pathWithVal);
                }
            }
        }

        // If we expanded templates, those paths are "complete" for this level of abstraction?
        // The Schema `dimensions` array implies sequential hierarchy. 
        // BUT, if `templateMapping` is used (like in MUSE), the template *provides* the inner dimensions (row/col).
        // The `module.dimensions` might STOP after `level` for MUSE?
        // Let's check the schema example for MUSE:
        // params: dimensions: [{ label: "level", values: [...], templateMapping: {...} }]
        // It only has ONE dimension in the top list. The `row` and `col` come from the template.
        // SO: We should only iterate `module.dimensions`. If a dimension applies a template, 
        // we expand that template's dimensions and append them, then continue?
        // Actually, if a dimension applies a template, that usually implies the "children" of this node are defined by the template.

        currentPaths = nextPaths;
    }

    return currentPaths;
}

function expandTemplate(basePath: string, template: DimensionTemplate): string[] {
    let paths = [basePath];
    for (const dim of template.dimensions) {
        const nextPaths: string[] = [];
        for (const p of paths) {
            for (const val of dim.values) {
                nextPaths.push(`${p}:${dim.label}-${val}`);
            }
        }
        paths = nextPaths;
    }
    return paths;
}


export function calculateModuleMetrics(module: StorageModule, items: Item[], templates: DimensionTemplate[]): StorageModuleMetrics {
    const validPaths = generateValidPaths(module, templates);
    const capacity = validPaths.length;

    // Filter items that belong to this module
    const moduleItems = items.filter(i => i.location.startsWith(module.name + ":"));

    // Count occupied slots (assuming 1 item per slot for now, or just simply counting items)
    // The spec says "One Item Per Location".
    const occupiedLocations = new Set(moduleItems.map(i => i.location));

    // Check intersection with valid paths to ensure we don't count invalid locations?
    // (Though database shouldn't have them).
    let totalItems = 0;
    for (const path of validPaths) {
        if (occupiedLocations.has(path)) {
            totalItems++;
        }
    }

    return {
        moduleId: module._id,
        moduleName: module.name,
        totalItems,
        capacity,
        utilizationPercentage: capacity > 0 ? (totalItems / capacity) * 100 : 0
    };
}
