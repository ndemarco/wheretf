'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define types for our data
export interface SearchResult {
    id: string; // Unique ID for the result (e.g., '1', '2')
    name: string;
    location: string; // "MUSE:level-1:row-2:col-3"
    moduleName: string;
}

interface VisualizationContextType {
    results: SearchResult[];
    setResults: (results: SearchResult[]) => void;

    activeResultId: string | null;
    setActiveResultId: (id: string | null) => void;

    // The location string currently being visualized (driven by activeResult or manual selection)
    activeLocation: string | null;
    showLocation: (location: string) => void;

    // View mode
    isNavigatorOpen: boolean;
    setNavigatorOpen: (isOpen: boolean) => void;
}

const VisualizationContext = createContext<VisualizationContextType | undefined>(undefined);

export function VisualizationProvider({ children }: { children: ReactNode }) {
    const [results, setResults] = useState<SearchResult[]>([]);
    const [activeResultId, setActiveResultId] = useState<string | null>(null);
    const [activeLocation, setActiveLocation] = useState<string | null>(null);
    const [isNavigatorOpen, setNavigatorOpen] = useState(false);

    const showLocation = (location: string) => {
        setActiveLocation(location);
        setNavigatorOpen(true);
        // If this location matches a result, highlight it? 
        // For now simple setting is enough.
    };

    const handleSetActiveResult = (id: string | null) => {
        setActiveResultId(id);
        if (id) {
            const result = results.find(r => r.id === id);
            if (result) {
                showLocation(result.location);
            }
        }
    };

    return (
        <VisualizationContext.Provider
            value={{
                results,
                setResults,
                activeResultId,
                setActiveResultId: handleSetActiveResult,
                activeLocation,
                showLocation,
                isNavigatorOpen,
                setNavigatorOpen,
            }}
        >
            {children}
        </VisualizationContext.Provider>
    );
}

export function useVisualization() {
    const context = useContext(VisualizationContext);
    if (context === undefined) {
        throw new Error('useVisualization must be used within a VisualizationProvider');
    }
    return context;
}
