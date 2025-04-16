import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressCircleProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  size?: "sm" | "md" | "lg"
  showValue?: boolean
  textClassName?: string
}

export const ProgressCircle = React.forwardRef<HTMLDivElement, ProgressCircleProps>(
  ({ className, value, size = "md", showValue = false, textClassName, ...props }, ref) => {
    const radius = size === "sm" ? 8 : size === "md" ? 10 : 12
    const strokeWidth = size === "sm" ? 2 : size === "md" ? 2.5 : 3
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (value / 100) * circumference
    
    const sizeClass = {
      sm: "h-5 w-5",
      md: "h-8 w-8",
      lg: "h-12 w-12",
    }
    
    const textSize = {
      sm: "text-[8px]",
      md: "text-xs",
      lg: "text-sm",
    }

    return (
      <div
        className={cn("relative inline-flex items-center justify-center", sizeClass[size], className)}
        ref={ref}
        {...props}
      >
        <svg
          className="h-full w-full"
          viewBox={`0 0 ${radius * 2 + strokeWidth * 2} ${radius * 2 + strokeWidth * 2}`}
        >
          <circle
            className="stroke-muted"
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
          />
          <circle
            className="stroke-primary transition-all duration-300 ease-in-out"
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${radius + strokeWidth} ${radius + strokeWidth})`}
          />
        </svg>
        {showValue && (
          <span className={cn("absolute text-center font-medium", textSize[size], textClassName)}>
            {Math.round(value)}%
          </span>
        )}
      </div>
    )
  }
)