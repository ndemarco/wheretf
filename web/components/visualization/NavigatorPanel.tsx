'use client';

import React from 'react';
import { useVisualization } from './VisualizationContext';
import { ResultsPanel } from './ResultsPanel';
import { StorageModuleVisualizer } from './StorageModuleVisualizer';
import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { parseLocation } from '@/lib/storage-engine';
import { StorageModule, DimensionTemplate } from '@/types/storage';

interface NavigatorPanelProps {
    // Props can still override internal fetching if needed, but we default to internal
    activeModule?: StorageModule;
    templates?: DimensionTemplate[];
}

export const NavigatorPanel: React.FC<NavigatorPanelProps> = ({ activeModule: propModule, templates: propTemplates }) => {
    const { isNavigatorOpen, setNavigatorOpen, activeLocation, activeResultId, setActiveResultId } = useVisualization();

    // 1. Determine module name from activeLocation
    // Format: "MUSE:level-1:..."
    let moduleName: string | undefined;
    if (activeLocation) {
        const parsed = parseLocation(activeLocation);
        moduleName = parsed.module;
    }

    // 2. Fetch Module Data
    const { data: fetchedModule, isLoading: isModuleLoading } = useQuery({
        queryKey: ['module', moduleName],
        queryFn: async () => {
            if (!moduleName) return null;
            const res = await fetch(`/api/modules/${moduleName}`);
            if (!res.ok) throw new Error('Failed to fetch module');
            return res.json() as Promise<StorageModule>;
        },
        enabled: !!moduleName && !propModule, // Only fetch if we have a name and no prop
    });

    const activeModule = propModule || fetchedModule;

    // 3. Fetch Templates (Global or module specific?)
    // We fetch all templates for now
    const { data: fetchedTemplates, isLoading: isTemplatesLoading } = useQuery({
        queryKey: ['templates'],
        queryFn: async () => {
            const res = await fetch(`/api/templates`);
            if (!res.ok) throw new Error('Failed to fetch templates');
            return res.json() as Promise<DimensionTemplate[]>;
        },
        enabled: !propTemplates && !!activeModule, // Fetch if we need to show visualization
    });

    const templates = propTemplates || fetchedTemplates;

    if (!isNavigatorOpen) return null;

    return (
        <div className="h-full flex border-l border-zinc-800 bg-zinc-950">
            {/* Panel 1: Results - Always visible if navigation is open */}
            <div className="w-64 border-r border-zinc-800 flex flex-col">
                <div className="p-2 border-b border-zinc-800 flex justify-between items-center">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-2">Navigator</span>
                    <div className="flex items-center gap-2">
                        <a href="/audit" className="text-xs text-zinc-500 hover:text-zinc-300 px-2" title="Audit Log">Audit</a>
                        <button onClick={() => setNavigatorOpen(false)} className="p-1 hover:bg-zinc-800 rounded text-zinc-400">
                            <X size={14} />
                        </button>
                    </div>
                </div>
                <ResultsPanel />
            </div>

            {/* Panel 2: Map - Visible if we have an active location */}
            {activeLocation ? (
                <div className="w-80 flex flex-col bg-zinc-950/50">
                    <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-200 text-sm">Location View</span>
                        </div>
                        <button
                            onClick={() => { setActiveResultId(null); /* activeLocation remains, but maybe we unselect result? */ }}
                            className="text-xs text-zinc-500 hover:text-zinc-300"
                        >
                            Clear
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                        {isModuleLoading || isTemplatesLoading ? (
                            <div className="flex justify-center items-center h-40">
                                <span className="text-zinc-500 text-xs animate-pulse">Loading visualizer...</span>
                            </div>
                        ) : activeModule && templates ? (
                            <StorageModuleVisualizer
                                module={activeModule}
                                templates={templates}
                                highlightLocation={activeLocation}
                            />
                        ) : (
                            <div className="text-red-500 text-xs text-center mt-10">
                                Failed to load module data.
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="w-80 flex flex-col items-center justify-center text-zinc-600 p-8 text-center border-l bg-zinc-950/30">
                    <p className="text-sm">Select an item from the results to see its location.</p>
                </div>
            )}
        </div>
    );
};
