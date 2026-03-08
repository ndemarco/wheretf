import React from 'react';
import { StorageModuleVisualizer } from '@/components/visualization/StorageModuleVisualizer';
import { MOCK_MODULES, MOCK_TEMPLATES } from '@/data/mock-storage';

export default function DashboardPage() {
    return (
        <div className="min-h-screen bg-black text-zinc-100 p-8 font-sans">
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                    Storage Dashboard
                </h1>
                <p className="text-zinc-500">Utilization & Structure Preview</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div>
                    <h2 className="text-xl font-semibold mb-4 text-zinc-300">MUSE Visualizer</h2>
                    {/* Example of visualizing MUSE with a specific highlight */}
                    <StorageModuleVisualizer
                        module={MOCK_MODULES[0]}
                        templates={MOCK_TEMPLATES}
                        highlightLocation="MUSE:level-3:row-2:col-5"
                    />
                </div>

                <div>
                    <h2 className="text-xl font-semibold mb-4 text-zinc-300">PRUSA Visualizer</h2>
                    <StorageModuleVisualizer
                        module={MOCK_MODULES[1]}
                        templates={MOCK_TEMPLATES}
                        highlightLocation="PRUSA:drawer-1:box-yellow:row-2:col-3"
                    />
                </div>

                <div className="p-6 border border-zinc-800 rounded-lg bg-zinc-900/40">
                    <h2 className="text-xl font-semibold mb-4 text-zinc-300">Metrics Preview</h2>
                    <p className="text-zinc-500 italic">Storage utilization metrics coming soon consistent with implementation plan.</p>
                </div>
            </div>
        </div>
    );
}
