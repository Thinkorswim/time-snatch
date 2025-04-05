import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn, timeDisplayFormat } from "@/lib/utils"
import { BlockedWebsite } from "@/models/BlockedWebsite";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    blockedWebsite: BlockedWebsite | null;
  }
>(({ className, blockedWebsite, ...props }, ref) => {

  const dayOfTheWeek = (new Date().getDay() + 6) % 7;

  const progressPercentage = React.useMemo(() => {
    if (!blockedWebsite) return 0;
    if (blockedWebsite.timeAllowed[dayOfTheWeek] == -1) return 0;
    if (blockedWebsite.totalTime >= blockedWebsite.timeAllowed[dayOfTheWeek]) return 100;
    return (
      (100 - (Math.abs(blockedWebsite.timeAllowed[dayOfTheWeek] - blockedWebsite.totalTime) /
        blockedWebsite.timeAllowed[dayOfTheWeek]) * 100)
    );
  }, [blockedWebsite, dayOfTheWeek]);


  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-10 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >

      {blockedWebsite ? (
        <>
          <ProgressPrimitive.Indicator
            className="h-full w-full flex-1 bg-primary transition-all"
            style={{ transform: `translateX(-${100 - (progressPercentage)}%)` }}
          />
          <div className="absolute inset-0 flex items-center justify-between px-4 text-sm font-normal text-muted-foreground">
            <div> {blockedWebsite.website}</div>
            {blockedWebsite.timeAllowed[dayOfTheWeek] == -1 ? (
              <div>Day Off</div>
            ) : (
              <div> {timeDisplayFormat(blockedWebsite.timeAllowed[dayOfTheWeek] - blockedWebsite.totalTime)}</div>
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

Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
