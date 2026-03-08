'use client';
import React from 'react';
import { StorageModule, DimensionTemplate } from '@/types/storage';
import { parseLocation } from '@/lib/storage-engine';
import { GridTemplate } from './GridTemplate';

interface StorageModuleVisualizerProps {
    module: StorageModule;
    templates: DimensionTemplate[];
    highlightLocation?: string; // "MUSE:level-3:row-2:col-5"
}

export const StorageModuleVisualizer: React.FC<StorageModuleVisualizerProps> = ({ module, templates, highlightLocation }) => {
    const parsedLocation = highlightLocation ? parseLocation(highlightLocation) : null;

    // Helper to get template by name
    const getTemplate = (name: string) => templates.find(t => t.name === name);

    // We need to render the hierarchy. 
    // Currently we support a simplified view: 
    // - Top level dimensions (usually "drawer" or "level")
    // - Inner generic dimensions (grid)

    // Find the top-level dimension that splits the unit (e.g. "level" or "drawer")
    const primaryDim = module.dimensions[0];

    if (!primaryDim) return <div>Empty Module</div>;

    return (
        <div className="flex flex-col gap-4 p-4 border border-zinc-800 rounded-lg bg-zinc-950 max-w-md">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                <h3 className="font-bold text-zinc-100">{module.name}</h3>
                <span className="text-xs text-zinc-500">{module.description}</span>
            </div>

            <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {primaryDim.values.map(val => {
                    const isPrimaryHighlighted = parsedLocation?.[primaryDim.label] === val;

                    // Determine the template for this drawer/level
                    let templateName: string | undefined;
                    if (primaryDim.template) {
                        // templateName = ... (need to handle ObjectId or hydrated string)
                        // In our simplistic type, we didn't fully resolve `template` vs `templateMapping`.
                        // Assuming string mapping for now based on spec examples.
                    } else if (primaryDim.templateMapping) {
                        templateName = primaryDim.templateMapping[val];
                    }

                    const template = templateName ? getTemplate(templateName) : undefined;

                    // Only show details if this level is highlighted OR if no specific location is highlighted (show all?),
                    // OR maybe just show a collapsed view for others.
                    // To keep it clean: always show "structure", but maybe collapsed or minified.

                    // If we are visualizing a search result, we want to expand the relevant one.
                    const isCollapsed = highlightLocation && !isPrimaryHighlighted;

                    return (
                        <div
                            key={val}
                            className={`
                border rounded transition-all duration-300
                ${isPrimaryHighlighted
                                    ? 'border-amber-500/50 bg-amber-900/10'
                                    : 'border-zinc-800 bg-zinc-900/50 opacity-60'}
              `}
                        >
                            <div className="px-3 py-2 flex items-center justify-between text-xs text-zinc-400 font-mono">
                                <span>{primaryDim.label.toUpperCase()} {val}</span>
                                {template && <span className="opacity-50">{template.name}</span>}
                            </div>

                            {!isCollapsed && template && (
                                <div className="p-2 border-t border-dashed border-zinc-800/50 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <GridTemplate
                                        template={template}
                                        highlightedCell={parsedLocation || undefined}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
