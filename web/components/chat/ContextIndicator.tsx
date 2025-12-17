'use client';

interface ContextStatus {
  used: number;
  max: number;
  percentage: number;
  warning: boolean;
  critical: boolean;
  suggestion?: string;
}

interface ContextIndicatorProps {
  context?: ContextStatus;
}

export function ContextIndicator({ context }: ContextIndicatorProps) {
  if (!context) return null;

  const { percentage, warning, critical, suggestion } = context;

  let bgColor = 'bg-green-500';
  if (critical) {
    bgColor = 'bg-red-500';
  } else if (warning) {
    bgColor = 'bg-yellow-500';
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <div className="flex items-center gap-1">
        <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${bgColor} transition-all duration-300`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <span>{percentage}%</span>
      </div>
      {suggestion && (
        <span className={critical ? 'text-red-500' : 'text-yellow-600 dark:text-yellow-400'}>
          {suggestion}
        </span>
      )}
    </div>
  );
}
