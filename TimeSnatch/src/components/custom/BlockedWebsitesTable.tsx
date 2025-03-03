import { scheduledBlockDisplay, timeDisplayFormat } from "@/lib/utils"
import { BlockedWebsite } from '@/lib/BlockedWebsite';
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
                        <TableCell>{timeDisplayFormat(website.timeAllowed)}</TableCell>
                        <TableCell>{timeDisplayFormat(website.timeAllowed - website.totalTime)}</TableCell>
                        <TableCell>{website.redirectUrl == "" ? "Inspiration" : website.redirectUrl}</TableCell>
                        <TableCell>{website.blockIncognito ? "Yes" : "No"}</TableCell>
                        <TableCell>
                            {website.scheduledBlockRanges.length === 0 && "None"}
                            {website.scheduledBlockRanges.map((range, index) => (
                                <div key={index}>
                                    {scheduledBlockDisplay(range)}
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
