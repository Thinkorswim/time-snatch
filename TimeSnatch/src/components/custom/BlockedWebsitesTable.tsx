import { scheduledBlockDisplay, timeDisplayFormat } from "@/lib/utils"
import { BlockedWebsite } from '@/models/BlockedWebsite';
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
    blockedWebsites: Record<string, BlockedWebsite>;
    deleteBlockedWebsite: (websiteName: string) => void;
    editBlockedWebsite: (websiteName: string) => void;
};

export const BlockedWebsitesTable: React.FC<BlockedWebsitesTableProps> = ({ blockedWebsites, deleteBlockedWebsite, editBlockedWebsite }) => {

    const dayOfTheWeek = (new Date().getDay() + 6) % 7;

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Website</TableHead>
                    <TableHead>Allowed Per Day</TableHead>
                    <TableHead>Time Left Today</TableHead>
                    <TableHead>Redirect</TableHead>
                    <TableHead>Incognito</TableHead>
                    <TableHead>Scheduled Block</TableHead>
                    <TableHead className="text-center">Options</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {Object.keys(blockedWebsites).length === 0 && (
                    <TableRow className="h-52">
                        <TableCell colSpan={7} className="text-center">No blocked websites to display.</TableCell>
                    </TableRow>
                )}
                {Object.entries(blockedWebsites).map(([key, website]) => (
                    <TableRow key={key}>
                        <TableCell className="font-medium">{website.website}</TableCell>
                        <TableCell className={website.variableSchedule ? "flex max-w-[260px] flex-wrap items-center" : ""}>
                            {website.variableSchedule ? (
                                Array.from({ length: 7 }, (_, i) => {
                                    const dayIndex = i; // Adjust the index to start from 1
                                    return (
                                        <div key={dayIndex} className="flex flex-col items-center mx-1 mt-1">
                                            <div
                                                className={
                                                    dayIndex === dayOfTheWeek
                                                        ? "w-16 h-16 m-1 flex flex-col items-center justify-center rounded-full cursor-pointer bg-primary text-muted-foreground select-none"
                                                        : "w-16 h-16 m-1 flex flex-col items-center justify-center rounded-full cursor-pointer bg-background text-muted-foreground select-none"
                                                }
                                            >
                                                {['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'][i]}
                                                <div className="text-[0.8rem]">
                                                    {timeDisplayFormat(website.timeAllowed[dayIndex], true)}
                                                </div>
                                            </div>

                                        </div>
                                    );
                                })

                            ) : (
                                timeDisplayFormat(website.timeAllowed[0])
                            )}
                        </TableCell>
                        <TableCell>
                            {website.timeAllowed[dayOfTheWeek] == -1 ? "Day Off" : timeDisplayFormat(website.timeAllowed[dayOfTheWeek] - website.totalTime)}
                        </TableCell>
                        <TableCell>{website.redirectUrl == "" ? "Inspiration" : website.redirectUrl}</TableCell>
                        <TableCell>{website.blockIncognito ? "Yes" : "No"}</TableCell>
                        <TableCell>
                            {website.scheduledBlockRanges.length === 0 && "None"}
                            {website.scheduledBlockRanges.map((range, index) => (
                                <div key={index} className={index !== website.scheduledBlockRanges.length - 1 ? "mb-5" : ""}>
                                    {scheduledBlockDisplay(range)}
                                    <div className="flex max-w-[130px] flex-wrap items-center">
                                        {range.days.every(day => day) ? (
                                            <div className="text-muted-foreground">Every Day</div>
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
                                                        {['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'][i]}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ))}
                        </TableCell>
                        <TableCell className="flex justify-center items-center space-x-2">
                            <Pencil className="w-5 h-5 text-chart-5 cursor-pointer" onClick={() => editBlockedWebsite(website.website)} />
                            <Trash2 className="w-5 h-5 text-chart-5 cursor-pointer" onClick={() => deleteBlockedWebsite(website.website)} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};
