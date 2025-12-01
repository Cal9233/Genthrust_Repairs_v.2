import { cn } from "@/lib/utils";

type TurbineSpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
};

export function TurbineSpinner({ size = "md", className }: TurbineSpinnerProps) {
  const dimensions = sizeMap[size];
  const center = dimensions / 2;
  const outerRadius = dimensions / 2 - 1;
  const bladeLength = outerRadius * 0.75;
  const bladeWidth = Math.max(1.5, dimensions * 0.08);
  const hubRadius = dimensions * 0.12;
  const bladeCount = 8;

  return (
    <svg
      width={dimensions}
      height={dimensions}
      viewBox={`0 0 ${dimensions} ${dimensions}`}
      className={cn("animate-turbine text-current", className)}
      role="status"
      aria-label="Loading"
    >
      {/* Outer ring */}
      <circle
        cx={center}
        cy={center}
        r={outerRadius}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.2"
      />

      {/* Turbine blades */}
      <g>
        {Array.from({ length: bladeCount }, (_, i) => {
          const angle = (i * 360) / bladeCount;
          const radians = (angle * Math.PI) / 180;
          const x2 = center + Math.sin(radians) * bladeLength;
          const y2 = center - Math.cos(radians) * bladeLength;

          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth={bladeWidth}
              strokeLinecap="round"
              opacity="0.8"
            />
          );
        })}
      </g>

      {/* Center hub */}
      <circle
        cx={center}
        cy={center}
        r={hubRadius}
        fill="currentColor"
        opacity="0.9"
      />

      <title>Loading...</title>
    </svg>
  );
}
