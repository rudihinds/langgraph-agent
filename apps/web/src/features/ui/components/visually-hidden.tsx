"use client";

import * as React from "react";
import { cn } from "@/lib/utils/utils";

interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {}

const VisuallyHidden = React.forwardRef<HTMLSpanElement, VisuallyHiddenProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "absolute w-[1px] h-[1px] p-0 m-[-1px] overflow-hidden clip-rect-0 whitespace-nowrap border-0",
        className
      )}
      {...props}
    />
  )
);

VisuallyHidden.displayName = "VisuallyHidden";

export { VisuallyHidden };
