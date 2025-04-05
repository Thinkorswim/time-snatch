import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn, timeDisplayFormat } from "@/lib/utils"
import { GlobalTimeBudget } from "@/models/GlobalTimeBudget";

const ProgressGlobal = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    globalTimeBudget: GlobalTimeBudget | null;
    website: string;
  }
>(({ className, globalTimeBudget, website, ...props }, ref) => {

  const dayOfTheWeek = (new Date().getDay() + 6) % 7;

  const progressPercentage = React.useMemo(() => {
    if (!website) return 0;
    if (!globalTimeBudget) return 0;
    if (globalTimeBudget.timeAllowed[dayOfTheWeek] == -1) return 0;
    if (globalTimeBudget.totalTime >= globalTimeBudget.timeAllowed[dayOfTheWeek]) return 100;
    return (
      (100 - (Math.abs(globalTimeBudget.timeAllowed[dayOfTheWeek] - globalTimeBudget.totalTime) /
        globalTimeBudget.timeAllowed[dayOfTheWeek]) * 100)
    );
  }, [globalTimeBudget, dayOfTheWeek]);


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
          <div className="absolute inset-0 flex items-center justify-between px-4 text-sm font-normal text-muted-foreground">
            <div>{website}</div>
            {globalTimeBudget.timeAllowed[dayOfTheWeek] == -1 ? (
              <div>Day Off</div>
            ) : (
              <div> {timeDisplayFormat(globalTimeBudget.timeAllowed[dayOfTheWeek] - globalTimeBudget.totalTime)}</div>
            )}
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
