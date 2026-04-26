import { useState, useRef, } from 'react';
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from '@/components/ui/button';
import { syncQuotesBg, type QuoteRecord } from '@/lib/sync';

interface QuotesFormProps {
    callback?: () => void;
}

export const QuotesForm: React.FC<QuotesFormProps> = ({ callback }) => {
    const [authorValue, setAuthorValue] = useState("");
    const [quoteValue, setQuoteValue] = useState("");

    const [isValidAuthor, setIsValidAuthor] = useState(true);
    const [isValidQuote, setIsValidQuote] = useState(true);
    const [isRepeatedQuote, setIsRepeatedQuote] = useState(false);

    const authorInputRef = useRef<HTMLInputElement | null>(null);
    const quoteInputRef = useRef<HTMLTextAreaElement | null>(null);

    const addQuote = async () => {
        const trimmedAuthor = authorValue.trim();
        const trimmedQuote = quoteValue.trim();

        if (!trimmedAuthor) {
            setIsValidAuthor(false);
            authorInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            authorInputRef.current?.focus();
            return;
        }
        if (!trimmedQuote) {
            setIsValidQuote(false);
            quoteInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            quoteInputRef.current?.focus();
            return;
        }

        const result = (await browser.storage.local.get('quotes')) as { quotes?: QuoteRecord[] };
        const quotes = Array.isArray(result.quotes) ? result.quotes : [];

        // Duplicate check ignores tombstoned rows.
        const exists = quotes.some(
            (q) => !q.deletedAt && q.author === trimmedAuthor && q.quote === trimmedQuote
        );
        if (exists) {
            setIsRepeatedQuote(true);
            return;
        }

        const now = new Date().toISOString();
        const newRecord: QuoteRecord = {
            id: crypto.randomUUID(),
            quote: trimmedQuote,
            author: trimmedAuthor,
            createdAt: now,
            deletedAt: null,
            syncedAt: null,
        };

        await browser.storage.local.set({ quotes: [...quotes, newRecord] });
        syncQuotesBg();

        if (callback) callback();
    };

    return (
        <div className="w-[99%] mx-auto">
            <div className="mt-5">
                <div className="mt-5 flex items-center" >
                    <Label htmlFor="authorName"> Author </Label>
                </div>
                <Input
                    ref={authorInputRef}
                    className='mt-2'
                    id="authorName"
                    value={authorValue}
                    placeholder="Enter Author Name"
                    onChange={(e) => { setAuthorValue(e.target.value); setIsValidAuthor(true); setIsRepeatedQuote(false); }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') addQuote();
                    }}
                />
                {!isValidAuthor && <p className="text-red-500 text-sm mt-2">The author field cannot be empty.</p>}
            </div>

            <div className="mt-5">
                <div className="mt-5 flex items-center" >
                    <Label htmlFor="quoteText"> Quote </Label>
                </div>
                <Textarea
                    ref={quoteInputRef}
                    className='mt-2'
                    id="quoteText"
                    value={quoteValue}
                    placeholder="Enter Quote"
                    onChange={(e) => { setQuoteValue(e.target.value); setIsValidQuote(true); setIsRepeatedQuote(false); }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') addQuote();
                    }}
                />
                {!isValidQuote && <p className="text-red-500 text-sm mt-2">The quote field cannot be empty.</p>}
            </div>

            {isRepeatedQuote && <p className="text-red-500 text-sm mt-2">This quote already exists.</p>}
            <div className='w-full text-right mb-2'>
                <Button className="mt-8" onClick={addQuote}> Add Quote </Button>
            </div>
        </div>
    );
};
