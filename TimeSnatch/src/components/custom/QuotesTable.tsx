import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button";


type QuotesTableProps = {
    quotes: Array<{ author: string; quote: string }> | null;
    addQuote: () => void;
    deleteQuote: (quoteDetails: { author: string; quote: string }) => void;
};

export const QuotesTable: React.FC<QuotesTableProps> = ({ quotes, addQuote, deleteQuote }) => {

    console.log("QuotesTable", quotes);

    return (
        <>
            <div className="flex items-center justify-between w-full mt-4 mb-2">
                <Label className='text-base '>Quotes Management</Label>
                <Button className="h-7 px-3" onClick={addQuote}> <Plus className='h-4 w-4 mr-1' /> Add Quote </Button>
            </div>
            <ScrollArea className="h-[400px] w-full rounded-md border">
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
                                <TableCell colSpan={7} className="text-center">No quotes to show.</TableCell>
                            </TableRow>
                        )}
                        {quotes && quotes.length >= 0 && (
                            quotes.map(({ author, quote }) => (
                                <TableRow key={`${author}-${quote}`}>
                                    <TableCell className="font-medium">{author}</TableCell>
                                    <TableCell>{quote}</TableCell>
                                    <TableCell className="flex justify-center items-center space-x-2">
                                        <Trash2
                                            className="w-5 h-5 text-chart-5 cursor-pointer"
                                            onClick={() => deleteQuote({ author, quote })}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </>
    );
};
