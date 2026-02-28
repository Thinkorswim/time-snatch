"use client"
import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { convertSecondsToHoursMinutesSeconds } from "@/lib/utils"

type PeriodKey = "last7" | "last31" | "thisWeek" | "lastWeek" | "thisMonth" | "allTime" | "custom"

type WebsiteStat = {
  blocked: number
  restricted: number
}

type AggregateResult = {
  totalBlocked: number
  totalRestricted: number
  websiteMap: Record<string, WebsiteStat>
}

type StatsOverviewProps = {
  historicalRestrictedTimePerDay: Record<string, Record<string, number>>
  historicalBlockedPerDay: Record<string, Record<string, number>>
}

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "last7", label: "Last 7 days" },
  { value: "thisWeek", label: "This week" },
  { value: "lastWeek", label: "Last week" },
  { value: "last31", label: "Last 31 days" },
  { value: "thisMonth", label: "This month" },
  { value: "allTime", label: "All time" },
  { value: "custom", label: "Custom" },
]

const toDateStr = (date: Date): string => date.toLocaleDateString("en-CA").slice(0, 10)

const isValidDateStr = (str: string): boolean => {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false
  const d = new Date(`${str}T00:00:00`)
  return !isNaN(d.getTime())
}

const formatRestrictedTime = (seconds: number): string => {
  if (seconds === 0) return "0m"
  const { hours, minutes } = convertSecondsToHoursMinutesSeconds(seconds)
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

const formatRangeLabel = (start: string, end: string): string => {
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  const sameYear = s.getFullYear() === e.getFullYear()
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    })
  return `${fmt(s, !sameYear)} - ${fmt(e, true)}`
}

const getPeriodRange = (
  period: PeriodKey,
  historicalRestrictedTimePerDay: Record<string, Record<string, number>>,
  historicalBlockedPerDay: Record<string, Record<string, number>>,
  customStart: string,
  customEnd: string,
): { start: string; end: string } => {
  const today = new Date()
  const todayStr = toDateStr(today)

  switch (period) {
    case "last7": {
      const start = new Date(today)
      start.setDate(today.getDate() - 6)
      return { start: toDateStr(start), end: todayStr }
    }
    case "last31": {
      const start = new Date(today)
      start.setDate(today.getDate() - 30)
      return { start: toDateStr(start), end: todayStr }
    }
    case "thisWeek": {
      const start = new Date(today)
      const day = today.getDay()
      start.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
      return { start: toDateStr(start), end: todayStr }
    }
    case "lastWeek": {
      const endDay = new Date(today)
      const day = today.getDay()
      endDay.setDate(today.getDate() - (day === 0 ? 7 : day))
      const startDay = new Date(endDay)
      startDay.setDate(endDay.getDate() - 6)
      return { start: toDateStr(startDay), end: toDateStr(endDay) }
    }
    case "thisMonth": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: toDateStr(start), end: todayStr }
    }
    case "allTime": {
      const dates = Array.from(
        new Set([
          ...Object.keys(historicalRestrictedTimePerDay ?? {}),
          ...Object.keys(historicalBlockedPerDay ?? {}),
        ]),
      )
      if (dates.length === 0) return { start: todayStr, end: todayStr }
      dates.sort()
      return { start: dates[0], end: todayStr }
    }
    case "custom":
      return { start: customStart || todayStr, end: customEnd || todayStr }
  }
}

const aggregateDate = (
  date: string,
  historicalRestrictedTimePerDay: Record<string, Record<string, number>>,
  historicalBlockedPerDay: Record<string, Record<string, number>>,
): AggregateResult => {
  const restrictedBySite = historicalRestrictedTimePerDay?.[date] ?? {}
  const blockedBySite = historicalBlockedPerDay?.[date] ?? {}
  const allSites = new Set([...Object.keys(restrictedBySite), ...Object.keys(blockedBySite)])

  let totalBlocked = 0
  let totalRestricted = 0
  const websiteMap: Record<string, WebsiteStat> = {}

  allSites.forEach((site) => {
    const blocked = blockedBySite[site] || 0
    const restricted = restrictedBySite[site] || 0
    websiteMap[site] = { blocked, restricted }
    totalBlocked += blocked
    totalRestricted += restricted
  })

  return { totalBlocked, totalRestricted, websiteMap }
}

const computePeriodStats = (
  historicalRestrictedTimePerDay: Record<string, Record<string, number>>,
  historicalBlockedPerDay: Record<string, Record<string, number>>,
  start: string,
  end: string,
): AggregateResult => {
  let totalBlocked = 0
  let totalRestricted = 0
  const websiteMap: Record<string, WebsiteStat> = {}

  if (!isValidDateStr(start) || !isValidDateStr(end)) {
    return { totalBlocked, totalRestricted, websiteMap }
  }

  const cursor = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T00:00:00`)

  if (cursor > endDate) return { totalBlocked, totalRestricted, websiteMap }

  while (cursor <= endDate) {
    const dateStr = toDateStr(cursor)
    const dateStats = aggregateDate(dateStr, historicalRestrictedTimePerDay, historicalBlockedPerDay)

    totalBlocked += dateStats.totalBlocked
    totalRestricted += dateStats.totalRestricted

    Object.entries(dateStats.websiteMap).forEach(([site, stat]) => {
      if (!websiteMap[site]) {
        websiteMap[site] = { blocked: 0, restricted: 0 }
      }
      websiteMap[site].blocked += stat.blocked
      websiteMap[site].restricted += stat.restricted
    })

    cursor.setDate(cursor.getDate() + 1)
  }

  return { totalBlocked, totalRestricted, websiteMap }
}

export function StatsOverview({
  historicalRestrictedTimePerDay,
  historicalBlockedPerDay,
}: StatsOverviewProps) {
  const today = new Date()
  const todayDate = toDateStr(today)
  const todayLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

  const [period, setPeriod] = useState<PeriodKey>("last7")
  const [draftStart, setDraftStart] = useState(todayDate)
  const [draftEnd, setDraftEnd] = useState(todayDate)
  const [appliedStart, setAppliedStart] = useState(todayDate)
  const [appliedEnd, setAppliedEnd] = useState(todayDate)

  const canApply = isValidDateStr(draftStart) && isValidDateStr(draftEnd) && draftStart <= draftEnd

  const handleApply = () => {
    if (!canApply) return
    setAppliedStart(draftStart)
    setAppliedEnd(draftEnd)
  }

  const daily = aggregateDate(todayDate, historicalRestrictedTimePerDay, historicalBlockedPerDay)
  const dailyWebsites = Object.entries(daily.websiteMap).sort(
    ([, a], [, b]) => b.restricted - a.restricted || b.blocked - a.blocked,
  )

  const { start, end } = getPeriodRange(
    period,
    historicalRestrictedTimePerDay,
    historicalBlockedPerDay,
    appliedStart,
    appliedEnd,
  )
  const periodStats = computePeriodStats(historicalRestrictedTimePerDay, historicalBlockedPerDay, start, end)
  const periodWebsites = Object.entries(periodStats.websiteMap).sort(
    ([, a], [, b]) => b.restricted - a.restricted || b.blocked - a.blocked,
  )

  const selectedLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "Last 7 days"
  const hasAnyData =
    Object.keys(historicalRestrictedTimePerDay ?? {}).length > 0 ||
    Object.keys(historicalBlockedPerDay ?? {}).length > 0
  const rangeLabel =
    period === "allTime" && !hasAnyData
      ? "No data yet"
      : isValidDateStr(start) && isValidDateStr(end)
        ? formatRangeLabel(start, end)
        : "Select a valid range"

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
      <Card className="gap-5">
        <CardHeader className="gap-1">
          <CardTitle className="text-3xl font-bold text-muted-foreground">Today</CardTitle>
          <CardDescription>{todayLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-8 mb-6">
            <div>
              <p className="text-3xl font-bold">{daily.totalBlocked}</p>
              <p className="text-sm text-muted-foreground mt-0.5">blocked attempts</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{formatRestrictedTime(daily.totalRestricted)}</p>
              <p className="text-sm text-muted-foreground mt-0.5">restricted time</p>
            </div>
          </div>
          {dailyWebsites.length > 0 ? (
            <div className="space-y-2">
              {dailyWebsites.slice(0, 6).map(([site, stat]) => (
                <div key={site} className="flex items-center gap-2">
                  <span className="text-sm font-medium flex-1 truncate">{site}</span>
                  <span className="text-sm text-muted-foreground">{stat.blocked} blocked</span>
                  <span className="text-sm text-muted-foreground">-</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    {formatRestrictedTime(stat.restricted)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No activity today yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="gap-5">
        <CardHeader className="gap-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-3xl font-bold text-muted-foreground">{selectedLabel}</CardTitle>
              <CardDescription className="mt-1">{rangeLabel}</CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-36 justify-between flex-shrink-0"
                >
                  <span className="truncate text-sm">{selectedLabel}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-44">
                {PERIOD_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setPeriod(option.value)}
                  >
                    <Check className={`mr-2 h-4 w-4 ${period === option.value ? "opacity-100" : "opacity-0"}`} />
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="date"
                value={draftStart}
                max={draftEnd || todayDate}
                onChange={(e) => setDraftStart(e.target.value)}
                className="h-8 text-sm"
              />
              <span className="text-muted-foreground text-sm flex-shrink-0">-</span>
              <Input
                type="date"
                value={draftEnd}
                min={draftStart}
                max={todayDate}
                onChange={(e) => setDraftEnd(e.target.value)}
                className="h-8 text-sm"
              />
              <Button size="sm" className="h-8 flex-shrink-0" disabled={!canApply} onClick={handleApply}>
                Apply
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex gap-8 mb-6">
            <div>
              <p className="text-3xl font-bold">{periodStats.totalBlocked}</p>
              <p className="text-sm text-muted-foreground mt-0.5">blocked attempts</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{formatRestrictedTime(periodStats.totalRestricted)}</p>
              <p className="text-sm text-muted-foreground mt-0.5">restricted time</p>
            </div>
          </div>
          {periodWebsites.length > 0 ? (
            <div className="space-y-2">
              {periodWebsites.slice(0, 8).map(([site, stat]) => (
                <div key={site} className="flex items-center gap-2">
                  <span className="text-sm font-medium flex-1 truncate">{site}</span>
                  <span className="text-sm text-muted-foreground">{stat.blocked} blocked</span>
                  <span className="text-sm text-muted-foreground">-</span>
                  <span className="text-sm font-mono text-muted-foreground">{formatRestrictedTime(stat.restricted)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No activity for this period.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
