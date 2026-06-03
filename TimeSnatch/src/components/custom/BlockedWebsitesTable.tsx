import { scheduledBlockDisplay, timeDisplayFormat } from "@/lib/utils"
import { t, useLocale, weekdaysShort } from "@/lib/i18n"
import type { BlockedWebsiteRecord, CounterRecord } from '@/lib/sync';
import { totalForTarget, todayDateStr } from '@/lib/counters';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Pencil, Trash2 } from "lucide-react";

type BlockedWebsitesTableProps = {
    blockedWebsites: BlockedWebsiteRecord[];
    counters: CounterRecord[];
    deleteBlockedWebsite: (websiteName: string) => void;
    editBlockedWebsite: (websiteName: string) => void;
};

export const BlockedWebsitesTable: React.FC<BlockedWebsitesTableProps> = ({
    blockedWebsites,
    counters,
    deleteBlockedWebsite,
    editBlockedWebsite,
}) => {
    useLocale();
    const dayShort = weekdaysShort();
    const dayOfTheWeek = (new Date().getDay() + 6) % 7;
    const today = todayDateStr();

    // Shared per-row computation used by both the desktop table and mobile cards.
    const computeRow = (website: BlockedWebsiteRecord) => {
        const allowed = website.timeAllowed[String(dayOfTheWeek)];
        const used = totalForTarget(counters, today, 'website_time', website.website);
        return { allowed, used };
    };

    // Variable-schedule day circles, reused in both views.
    const dayCircles = (website: BlockedWebsiteRecord) => (
        Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex flex-col items-center mx-1 mt-1">
                <div
                    className={
                        i === dayOfTheWeek
                            ? "w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 m-1 flex flex-col items-center justify-center rounded-full cursor-pointer bg-primary text-muted-foreground select-none"
                            : "w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 m-1 flex flex-col items-center justify-center rounded-full cursor-pointer bg-background text-muted-foreground select-none"
                    }
                >
                    {dayShort[i]}
                    <div className="text-[0.65rem] md:text-[0.8rem]">
                        {timeDisplayFormat(website.timeAllowed[String(i)] ?? 0, true)}
                    </div>
                </div>
            </div>
        ))
    );

    // Scheduled block days circles, reused in both views.
    const scheduledBlocks = (website: BlockedWebsiteRecord) => (
        <>
            {website.scheduledBlockRanges.length === 0 && t('common.none')}
            {website.scheduledBlockRanges.map((range, index) => (
                <div key={index} className={index !== website.scheduledBlockRanges.length - 1 ? "mb-5" : ""}>
                    {scheduledBlockDisplay(range)}
                    <div className="flex flex-wrap items-center">
                        {range.days.every(day => day) ? (
                            <div className="text-muted-foreground">{t('common.everyDay')}</div>
                        ) : (
                            Array.from({ length: 7 }, (_, i) => (
                                <div key={i} className="flex flex-col items-center">
                                    <div
                                        className={
                                            range.days[i]
                                                ? "w-7 h-7 mr-1 mt-1 flex flex-col items-center justify-center rounded-full cursor-pointer bg-primary text-muted-foreground select-none"
                                                : "w-7 h-7 mr-1 mt-1 flex flex-col items-center justify-center rounded-full cursor-pointer bg-background text-muted-foreground select-none"
                                        }
                                    >
                                        {dayShort[i]}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ))}
        </>
    );

    return (
        <>
            {/* Desktop: full table (≥ md) */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('blockedWebsitesTable.website')}</TableHead>
                            <TableHead>{t('blockedWebsitesTable.allowedPerDay')}</TableHead>
                            <TableHead>{t('blockedWebsitesTable.timeLeftToday')}</TableHead>
                            <TableHead>{t('blockedWebsitesTable.redirect')}</TableHead>
                            <TableHead>{t('blockedWebsitesTable.incognito')}</TableHead>
                            <TableHead>{t('blockedWebsitesTable.scheduledBlock')}</TableHead>
                            <TableHead className="text-center">{t('blockedWebsitesTable.options')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {blockedWebsites.length === 0 && (
                            <TableRow className="h-52">
                                <TableCell colSpan={7} className="text-center">{t('blockedWebsitesTable.noWebsites')}</TableCell>
                            </TableRow>
                        )}
                        {blockedWebsites.map((website) => {
                            const { allowed, used } = computeRow(website);
                            return (
                                <TableRow key={website.website}>
                                    <TableCell className="font-medium">{website.website}</TableCell>
                                    <TableCell className={website.variableSchedule ? "flex max-w-[260px] flex-wrap items-center" : ""}>
                                        {website.variableSchedule ? (
                                            dayCircles(website)
                                        ) : (
                                            timeDisplayFormat(website.timeAllowed["0"] ?? 0)
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {allowed === -1 ? t('common.dayOff') : timeDisplayFormat((allowed ?? 0) - used)}
                                    </TableCell>
                                    <TableCell>{website.redirectUrl === "" ? t('common.inspiration') : website.redirectUrl}</TableCell>
                                    <TableCell>{website.blockIncognito ? t('common.yes') : t('common.no')}</TableCell>
                                    <TableCell>
                                        {scheduledBlocks(website)}
                                    </TableCell>
                                    <TableCell className="flex justify-center items-center space-x-2">
                                        <Pencil className="w-5 h-5 text-chart-5 cursor-pointer" onClick={() => editBlockedWebsite(website.website)} />
                                        <Trash2 className="w-5 h-5 text-chart-5 cursor-pointer" onClick={() => deleteBlockedWebsite(website.website)} />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile: stacked cards (< md) */}
            <div className="md:hidden flex flex-col gap-3">
                {blockedWebsites.length === 0 && (
                    <div className="py-16 text-center text-muted-foreground">{t('blockedWebsitesTable.noWebsites')}</div>
                )}
                {blockedWebsites.map((website) => {
                    const { allowed, used } = computeRow(website);
                    return (
                        <div key={website.website} className="rounded-lg border bg-background p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="font-medium break-all">{website.website}</div>
                                <div className="flex items-center space-x-3 shrink-0">
                                    <Pencil className="w-5 h-5 text-chart-5 cursor-pointer" onClick={() => editBlockedWebsite(website.website)} />
                                    <Trash2 className="w-5 h-5 text-chart-5 cursor-pointer" onClick={() => deleteBlockedWebsite(website.website)} />
                                </div>
                            </div>

                            <div className="mt-3 space-y-3 text-sm">
                                <div>
                                    <div className="text-muted-foreground">{t('blockedWebsitesTable.allowedPerDay')}</div>
                                    {website.variableSchedule ? (
                                        <div className="flex flex-wrap items-center">{dayCircles(website)}</div>
                                    ) : (
                                        <div className="font-medium">{timeDisplayFormat(website.timeAllowed["0"] ?? 0)}</div>
                                    )}
                                </div>

                                <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">{t('blockedWebsitesTable.timeLeftToday')}</span>
                                    <span className="font-medium text-right">{allowed === -1 ? t('common.dayOff') : timeDisplayFormat((allowed ?? 0) - used)}</span>
                                </div>

                                <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">{t('blockedWebsitesTable.redirect')}</span>
                                    <span className="font-medium text-right break-all">{website.redirectUrl === "" ? t('common.inspiration') : website.redirectUrl}</span>
                                </div>

                                <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">{t('blockedWebsitesTable.incognito')}</span>
                                    <span className="font-medium text-right">{website.blockIncognito ? t('common.yes') : t('common.no')}</span>
                                </div>

                                <div>
                                    <div className="text-muted-foreground">{t('blockedWebsitesTable.scheduledBlock')}</div>
                                    <div className="mt-1">{scheduledBlocks(website)}</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
};
