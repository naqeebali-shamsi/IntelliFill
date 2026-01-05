import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * Data point for the mini chart
 */
export interface MiniChartDataPoint {
  /** Short label displayed below the bar (e.g., "Mon", "Tue") */
  label: string;
  /** Numeric value for the bar height */
  value: number;
}

/**
 * Default activity data for demonstration
 */
const defaultData: MiniChartDataPoint[] = [
  { label: 'Mon', value: 65 },
  { label: 'Tue', value: 85 },
  { label: 'Wed', value: 45 },
  { label: 'Thu', value: 95 },
  { label: 'Fri', value: 70 },
  { label: 'Sat', value: 55 },
  { label: 'Sun', value: 80 },
];

export interface MiniChartProps {
  /** Data points to display as bars */
  data?: MiniChartDataPoint[];
  /** Title label (default: "Activity") */
  title?: string;
  /** Unit suffix for values (default: "%") */
  unit?: string;
  /** Whether to show a pulsing indicator dot */
  showIndicator?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
  /** Height of the chart area in pixels (default: 96) */
  chartHeight?: number;
  /** Chart bar color class (default: uses foreground) */
  barColorClass?: string;
}

/**
 * MiniChart - A compact, interactive bar chart component for activity visualization.
 *
 * Features:
 * - Hover interactions with value tooltip
 * - Smooth animations and scaling effects
 * - Customizable data, title, and styling
 * - Responsive design with glassmorphism effect
 *
 * @example
 * // Basic usage with default data
 * <MiniChart />
 *
 * @example
 * // Custom data
 * <MiniChart
 *   data={[
 *     { label: "Jan", value: 120 },
 *     { label: "Feb", value: 85 },
 *     { label: "Mar", value: 200 },
 *   ]}
 *   title="Documents Processed"
 *   unit=""
 * />
 *
 * @example
 * // Custom styling
 * <MiniChart
 *   title="Uploads"
 *   barColorClass="bg-emerald-500"
 *   showIndicator={false}
 * />
 */
export function MiniChart({
  data = defaultData,
  title = 'Activity',
  unit = '%',
  showIndicator = true,
  className,
  chartHeight = 96,
  barColorClass,
}: MiniChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [displayValue, setDisplayValue] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const maxValue = Math.max(...data.map((d) => d.value));

  useEffect(() => {
    if (hoveredIndex !== null) {
      setDisplayValue(data[hoveredIndex].value);
    }
  }, [hoveredIndex, data]);

  const handleContainerEnter = () => setIsHovering(true);
  const handleContainerLeave = () => {
    setIsHovering(false);
    setHoveredIndex(null);
    setTimeout(() => {
      setDisplayValue(null);
    }, 150);
  };

  return (
    <div
      ref={containerRef}
      data-slot="mini-chart"
      onMouseEnter={handleContainerEnter}
      onMouseLeave={handleContainerLeave}
      className={cn(
        'group relative w-72 p-6 rounded-2xl',
        'bg-foreground/[0.02] border border-foreground/[0.06] backdrop-blur-sm',
        'transition-all duration-500',
        'hover:bg-foreground/[0.04] hover:border-foreground/[0.1]',
        'flex flex-col gap-4',
        className
      )}
    >
      {/* Header */}
      <div data-slot="mini-chart-header" className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {showIndicator && (
            <div
              data-slot="mini-chart-indicator"
              className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
            />
          )}
          <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
            {title}
          </span>
        </div>
        <div className="relative h-7 flex items-center">
          <span
            className={cn(
              'text-lg font-semibold tabular-nums transition-all duration-300 ease-out',
              isHovering && displayValue !== null
                ? 'opacity-100 text-foreground'
                : 'opacity-50 text-muted-foreground'
            )}
          >
            {displayValue !== null ? displayValue : ''}
            <span
              className={cn(
                'text-xs font-normal text-muted-foreground ml-0.5 transition-opacity duration-300',
                displayValue !== null ? 'opacity-100' : 'opacity-0'
              )}
            >
              {unit}
            </span>
          </span>
        </div>
      </div>

      {/* Chart */}
      <div
        data-slot="mini-chart-bars"
        className="flex items-end gap-2"
        style={{ height: chartHeight }}
      >
        {data.map((item, index) => {
          const heightPx = (item.value / maxValue) * chartHeight;
          const isHovered = hoveredIndex === index;
          const isAnyHovered = hoveredIndex !== null;
          const isNeighbor =
            hoveredIndex !== null && (index === hoveredIndex - 1 || index === hoveredIndex + 1);

          return (
            <div
              key={`${item.label}-${index}`}
              data-slot="mini-chart-bar-container"
              className="relative flex-1 flex flex-col items-center justify-end h-full"
              onMouseEnter={() => setHoveredIndex(index)}
            >
              {/* Bar */}
              <div
                data-slot="mini-chart-bar"
                className={cn(
                  'w-full rounded-full cursor-pointer transition-all duration-300 ease-out origin-bottom',
                  barColorClass
                    ? cn(
                        isHovered ? barColorClass : '',
                        isNeighbor ? `${barColorClass}/30` : '',
                        !isHovered && !isNeighbor && isAnyHovered ? `${barColorClass}/10` : '',
                        !isAnyHovered ? `${barColorClass}/20 group-hover:${barColorClass}/25` : ''
                      )
                    : cn(
                        isHovered ? 'bg-foreground' : '',
                        isNeighbor ? 'bg-foreground/30' : '',
                        !isHovered && !isNeighbor && isAnyHovered ? 'bg-foreground/10' : '',
                        !isAnyHovered ? 'bg-foreground/20 group-hover:bg-foreground/25' : ''
                      )
                )}
                style={{
                  height: `${heightPx}px`,
                  transform: isHovered
                    ? 'scaleX(1.15) scaleY(1.02)'
                    : isNeighbor
                      ? 'scaleX(1.05)'
                      : 'scaleX(1)',
                }}
              />

              {/* Label */}
              <span
                data-slot="mini-chart-label"
                className={cn(
                  'text-[10px] font-medium mt-2 transition-all duration-300',
                  isHovered ? 'text-foreground' : 'text-muted-foreground/60'
                )}
              >
                {item.label.charAt(0)}
              </span>

              {/* Tooltip */}
              <div
                data-slot="mini-chart-tooltip"
                className={cn(
                  'absolute -top-8 left-1/2 -translate-x-1/2',
                  'px-2 py-1 rounded-md',
                  'bg-foreground text-background text-xs font-medium',
                  'transition-all duration-200 whitespace-nowrap',
                  isHovered
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-1 pointer-events-none'
                )}
              >
                {item.value}
                {unit}
              </div>
            </div>
          );
        })}
      </div>

      {/* Subtle glow effect on hover */}
      <div
        data-slot="mini-chart-glow"
        className={cn(
          'absolute inset-0 rounded-2xl',
          'bg-gradient-to-b from-foreground/[0.02] to-transparent',
          'opacity-0 group-hover:opacity-100',
          'transition-opacity duration-500 pointer-events-none'
        )}
      />
    </div>
  );
}
