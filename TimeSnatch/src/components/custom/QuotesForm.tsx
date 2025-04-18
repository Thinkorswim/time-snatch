import { useState, useRef, } from 'react';
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react";
import { Button } from '@/components/ui/button';
import { validateURL, extractHostnameAndDomain, hasSubdomain, extractHighLevelDomain } from '@/lib/utils';
import { GlobalTimeBudget } from '@/models/GlobalTimeBudget';

interface QuotesFormProps {
    callback?: () => void; // Generic optional callback
}

export const QuotesForm: React.FC<QuotesFormProps> = ({ callback }) => {
    const [authorValue, setAuthorValue] = useState("");
    const [quoteValue, setQuoteValue] = useState("");

    const [isValidAuthor, setIsValidAuthor] = useState(true);
    const [isValidQuote, setIsValidQuote] = useState(true);
    const [isRepeatedQuote, setIsRepeatedQuote] = useState(false);

    const authorInputRef = useRef<HTMLInputElement | null>(null);
    const quoteInputRef = useRef<HTMLTextAreaElement | null>(null);

    // Add the blocked website to storage
    const addQuote = () => {

        if (authorValue.trim() !== "" && quoteValue.trim() !== "") {

            browser.storage.local.get(['quotes'], (data) => {
                if (data.quotes) {
                    const quotes = data.quotes as Array<{ author: string; quote: string }>;
                    const newQuote = { author: authorValue, quote: quoteValue };

                    // Check if the quote already exists
                    const quoteExists = quotes.some((quote) => {
                        return quote.author === newQuote.author && quote.quote === newQuote.quote;
                    });

                    if (quoteExists) {
                        setIsRepeatedQuote(true);
                        return;
                    } else {
                        quotes.push(newQuote);
                        browser.storage.local.set({ quotes: quotes }, () => {
                            if (callback) {
                                callback();
                            }
                        })
                    }

                }
            });
        } else {
            if (authorValue.trim() === "") {
                setIsValidAuthor(false);
                authorInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                authorInputRef.current?.focus();
            }
            if (quoteValue.trim() === "") {
                setIsValidQuote(false);
                quoteInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                quoteInputRef.current?.focus();
            }
        }
    }

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
                    onChange={(e) => { setAuthorValue(e.target.value) }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            addQuote();
                        }
                    }}
                />
                {!isValidAuthor && <p className="text-red-500 text-sm mt-2">The author field cannot be empty.</p>}
            </div>

            <div className="mt-5">
                <div className="mt-5 flex items-center" >
                    <Label htmlFor="authorName"> Quote </Label>
                </div>
                <Textarea
                    ref={quoteInputRef}
                    className='mt-2'
                    id="authorName"
                    value={quoteValue}
                    placeholder="Enter Quote"
                    onChange={(e) => { setQuoteValue(e.target.value) }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            addQuote();
                        }
                    }}
                />
                {!isValidQuote && <p className="text-red-500 text-sm mt-2">The quote field cannot be empty.</p>}
            </div>

            {isRepeatedQuote && <p className="text-red-500 text-sm mt-2">This quote already exists.</p>}
            <div className='w-full text-right mb-2'>
                <Button className="mt-8" onClick={addQuote}> Add Quote </Button>
            </div>

        </div >

    );
};

