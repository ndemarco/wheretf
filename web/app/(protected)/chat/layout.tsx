'use client';

import React from 'react';
import { VisualizationProvider } from '@/components/visualization/VisualizationContext';
import { NavigatorPanel } from '@/components/visualization/NavigatorPanel';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
    // This layout wraps all chat pages (/chat, /chat/[id])
    // It provides the VisualizationContext
    // It also renders the NavigatorPanel alongside the children (which is the actual chat)

    return (
        <VisualizationProvider>
            <div className="flex flex-1 h-full overflow-hidden">
                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {children}
                </div>

                {/* Navigator - Right Side */}
                {/* NavigatorPanel internally handles its own visibility/width (returns null if closed) */}
                <NavigatorPanel />
            </div>
        </VisualizationProvider>
    );
}
