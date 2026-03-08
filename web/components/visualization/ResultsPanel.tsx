'use client';

import React from 'react';
import { useVisualization } from './VisualizationContext';
import { Search } from 'lucide-react';

export const ResultsPanel = () => {
    const { results, activeResultId, setActiveResultId, isNavigatorOpen } = useVisualization();

    if (results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-4 text-center">
                <Search className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No items found yet.</p>
                <p className="text-xs opacity-70 mt-1">Ask the AI to find something!</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="p-3 border-b border-zinc-800 bg-zinc-900/50">
                <h3 className="font-semibold text-sm text-zinc-300">Found {results.length} Items</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {results.map((result, index) => {
                    const isActive = activeResultId === result.id;

                    return (
                        <button
                            key={result.id}
                            onClick={() => setActiveResultId(result.id)}
                            className={`
                w-full text-left p-3 rounded-md transition-all border
                flex items-start gap-3 group
                ${isActive
                                    ? 'bg-blue-900/20 border-blue-500/50 shadow-sm'
                                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800'}
              `}
                        >
                            <div
                                className={`
                  flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 mt-0.5
                  ${isActive
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700'}
                `}
                            >
                                {index + 1}
                            </div>

                            <div className="min-w-0">
                                <div className={`text-sm font-medium truncate ${isActive ? 'text-blue-200' : 'text-zinc-300'}`}>
                                    {result.name}
                                </div>
                                <div className="text-xs text-zinc-500 truncate mt-0.5 font-mono">
                                    {result.location}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
