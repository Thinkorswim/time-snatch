import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button";
import type { QuoteRecord } from '@/lib/sync';


type QuotesTableProps = {
    quotes: QuoteRecord[] | null;
    addQuote: () => void;
    deleteQuote: (record: QuoteRecord) => void;
};

export const QuotesTable: React.FC<QuotesTableProps> = ({ quotes, addQuote, deleteQuote }) => {
    return (
        <>
            <div className="flex items-center justify-between w-full mb-2">
                <Label className='text-base'>Quotes Management</Label>
                <Button className="h-7 px-3" onClick={addQuote}> <Plus className='h-4 w-4 mr-1' /> Add Quote </Button>
            </div>
            <ScrollArea className="h-[220px] w-full rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted">
                            <TableHead className="font-medium">Author</TableHead>
                            <TableHead className="font-medium">Quote</TableHead>
                            <TableHead className="text-center pr-4">Options</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(quotes === null || quotes.length === 0) && (
                            <TableRow className="h-52">
                                <TableCell colSpan={3} className="text-center">No quotes to show.</TableCell>
                            </TableRow>
                        )}
                        {quotes && quotes.map((record) => (
                            <TableRow key={record.id}>
                                <TableCell className="font-medium">{record.author}</TableCell>
                                <TableCell>{record.quote}</TableCell>
                                <TableCell className="flex justify-center items-center space-x-2">
                                    <Trash2
                                        className="w-5 h-5 text-chart-5 cursor-pointer"
                                        onClick={() => deleteQuote(record)}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
        </>
    );
};
