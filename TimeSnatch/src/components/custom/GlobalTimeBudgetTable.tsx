import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Trash2 } from "lucide-react";


type GlobalTimeBdugetTableProps = {
    globalTimeBudgetWebsites: Set<string> | null;
    deleteBlockedWebsite: (websiteName: string) => void;
};

export const GlobalTimeBudgetTable: React.FC<GlobalTimeBdugetTableProps> = ({ globalTimeBudgetWebsites, deleteBlockedWebsite }) => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Website</TableHead>
                    <TableHead className="text-center">Options</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {(globalTimeBudgetWebsites === null || globalTimeBudgetWebsites.size === 0) && (
                    <TableRow className="h-52">
                        <TableCell colSpan={7} className="text-center">No global blocked websites to display.</TableCell>
                    </TableRow>
                )}
                {globalTimeBudgetWebsites && globalTimeBudgetWebsites.size >= 0 && (
                    Array.from(globalTimeBudgetWebsites).map((website) => (
                        <TableRow key={website}>
                            <TableCell className="font-medium">{website}</TableCell>
                            <TableCell className="flex justify-center items-center space-x-2">
                                <Trash2
                                    className="w-5 h-5 text-chart-5 cursor-pointer"
                                    onClick={() => deleteBlockedWebsite(website)}
                                />
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    );
};
