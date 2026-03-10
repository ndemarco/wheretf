'use client';

import React from 'react';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-1 h-full overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0">
                {children}
            </div>
        </div>
    );
}
