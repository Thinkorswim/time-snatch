import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Trash2 } from "lucide-react";
import { t, useLocale } from "@/lib/i18n";


type GlobalTimeBudgetTableProps = {
    globalTimeBudgetWebsites: string[];
    deleteBlockedWebsite: (websiteName: string) => void;
};

export const GlobalTimeBudgetTable: React.FC<GlobalTimeBudgetTableProps> = ({ globalTimeBudgetWebsites, deleteBlockedWebsite }) => {
    useLocale();
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>{t('groupTimeBudgetTable.website')}</TableHead>
                    <TableHead className="text-center">{t('groupTimeBudgetTable.options')}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {globalTimeBudgetWebsites.length === 0 && (
                    <TableRow className="h-52">
                        <TableCell colSpan={2} className="text-center">{t('groupTimeBudgetTable.noWebsites')}</TableCell>
                    </TableRow>
                )}
                {globalTimeBudgetWebsites.map((website) => (
                    <TableRow key={website}>
                        <TableCell className="font-medium">{website}</TableCell>
                        <TableCell className="flex justify-center items-center space-x-2">
                            <Trash2
                                className="w-5 h-5 text-chart-5 cursor-pointer"
                                onClick={() => deleteBlockedWebsite(website)}
                            />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};
