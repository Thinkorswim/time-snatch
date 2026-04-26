import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn, timeDisplayFormat } from "@/lib/utils"
import type { GroupBudgetRecord } from "@/lib/sync"

const ProgressGlobal = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    globalTimeBudget: GroupBudgetRecord | null;
    website: string;
    usedToday: number;
  }
>(({ className, globalTimeBudget, website, usedToday, ...props }, ref) => {

  const dayOfTheWeek = (new Date().getDay() + 6) % 7;

  const progressPercentage = React.useMemo(() => {
    if (!website || !globalTimeBudget) return 0;
    const allowed = globalTimeBudget.timeAllowed[String(dayOfTheWeek)];
    if (allowed === -1) return 0;
    if (usedToday >= allowed) return 100;
    return 100 - (Math.abs(allowed - usedToday) / allowed) * 100;
  }, [globalTimeBudget, dayOfTheWeek, usedToday]);

  const allowed = globalTimeBudget?.timeAllowed[String(dayOfTheWeek)];

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
            style={{ transform: `translateX(-${100 - progressPercentage}%)` }}
          />
          <div className="absolute inset-0 flex items-center justify-between px-4 text-sm font-normal text-muted-foreground">
            <div>{website}</div>
            {allowed === -1 ? (
              <div>Day Off</div>
            ) : (
              <div>{timeDisplayFormat((allowed ?? 0) - usedToday)}</div>
            )}
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-between ">
          <div>Loading</div>
        </div>
      )}
    </ProgressPrimitive.Root>
  )
});

ProgressGlobal.displayName = ProgressPrimitive.Root.displayName

export { ProgressGlobal }
