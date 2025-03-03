import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn, timeDisplayFormat } from "@/lib/utils"
import { GlobalTimeBudget } from "@/lib/GlobalTimeBudget";

const ProgressGlobal = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    globalTimeBudget: GlobalTimeBudget | null;
    website: string;
  }
>(({ className, globalTimeBudget, website, ...props }, ref) => {

  const progressPercentage = React.useMemo(() => {
    if (!website) return 0;
    if (!globalTimeBudget) return 0;
    if (globalTimeBudget.totalTime >= globalTimeBudget.timeAllowed) return 100;
    return (
      (100 - (Math.abs(globalTimeBudget.timeAllowed - globalTimeBudget.totalTime) /
      globalTimeBudget.timeAllowed) * 100)
    );
  }, [globalTimeBudget]);


  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-10 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >

      {globalTimeBudget ? (
        <>
          <ProgressPrimitive.Indicator
            className="h-full w-full flex-1 bg-primary transition-all"
            style={{ transform: `translateX(-${100 - (progressPercentage)}%)` }}
          />
          <div className="absolute inset-0 flex items-center justify-between px-4">
            <div> {website}</div>
            <div> {timeDisplayFormat(globalTimeBudget.timeAllowed - globalTimeBudget.totalTime)}</div>
          </div>
        </>
      ) : (
        <>

          <div className="absolute inset-0 flex items-center justify-between ">
            <div> Loading</div>
          </div>
        </>
      )}

    </ProgressPrimitive.Root>
  )
});

ProgressGlobal.displayName = ProgressPrimitive.Root.displayName

export { ProgressGlobal }
