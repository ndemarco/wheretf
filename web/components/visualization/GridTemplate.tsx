import React from 'react';
import { DimensionTemplate } from '@/types/storage';

interface GridTemplateProps {
    template: DimensionTemplate;
    highlightedCell?: {
        row?: string;
        col?: string;
        [key: string]: string | undefined;
    };
    className?: string;
}

export const GridTemplate: React.FC<GridTemplateProps> = ({ template, highlightedCell, className = '' }) => {
    // Find row and col dimensions
    const rowDim = template.dimensions.find(d => d.label === 'row');
    const colDim = template.dimensions.find(d => d.label === 'col');

    if (!rowDim || !colDim) {
        return <div className="text-red-500">Invalid Grid Template: Missing row or col</div>;
    }

    return (
        <div
            className={`grid gap-1 border border-zinc-700 bg-zinc-900 p-2 rounded ${className}`}
            style={{
                gridTemplateColumns: `repeat(${colDim.values.length}, minmax(0, 1fr))`
            }}
        >
            {rowDim.values.map((rowVal) => (
                colDim.values.map((colVal) => {
                    const isHighlighted =
                        highlightedCell?.row === rowVal &&
                        highlightedCell?.col === colVal;

                    return (
                        <div
                            key={`${rowVal}-${colVal}`}
                            className={`
                aspect-square rounded-sm text-[10px] flex items-center justify-center
                border border-zinc-700/50 transition-all duration-200
                ${isHighlighted
                                    ? 'bg-amber-500 text-zinc-900 font-bold border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)] z-10 scale-110'
                                    : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}
              `}
                            title={`${rowVal}, ${colVal}`}
                        >
                            {/* Optional: Show coordinates if space permits, or just tooltip */}
                        </div>
                    );
                })
            ))}
        </div>
    );
};
