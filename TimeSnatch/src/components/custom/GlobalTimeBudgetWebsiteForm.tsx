import { useState, useRef, } from 'react';
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react";
import { Button } from '@/components/ui/button';
import { validateURL, extractHostnameAndDomain } from '@/lib/utils';
import { GlobalTimeBudget } from '@/lib/GlobalTimeBudget';

interface GlobalTimeBudgetWebsiteFormProps {
    callback?: () => void; // Generic optional callback
}

export const GlobalTimeBudgetWebsiteForm: React.FC<GlobalTimeBudgetWebsiteFormProps> = ({ callback }) => {
    const [websiteValue, setWebsiteValue] = useState("");
    const [isValidWebsite, setIsValidWebsite] = useState(true);

    const websiteInputRef = useRef<HTMLInputElement | null>(null);

    // Add the blocked website to storage
    const addGlobalTimeBudgetWebsite = () => {

        if (!validateURL(websiteValue)) {
            setIsValidWebsite(false);
            websiteInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            websiteInputRef.current?.focus();
            return;
        } else {
            const realUrl = extractHostnameAndDomain(websiteValue);

            if (realUrl) {
                chrome.storage.local.get(['globalTimeBudget'], (data) => {
                    if (data.globalTimeBudget) {
                        const globalTimeBudget = GlobalTimeBudget.fromJSON(data.globalTimeBudget);
                        globalTimeBudget.websites.add(realUrl)

                        chrome.storage.local.set({ globalTimeBudget: globalTimeBudget.toJSON() }, () => {
                            // Close the dialog
                            if (callback) {
                                callback();
                            }
                        })
                    }
                });
            } else {
                setIsValidWebsite(false);
                websiteInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                websiteInputRef.current?.focus();
                return;
            }
        }

    };

    return (
        <div className="w-[99%] mx-auto">
            <div className="mt-5">
                <div className="mt-5 flex items-center" >
                    <Label htmlFor="websiteName"> Website </Label>
                    <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild >
                                <button tabIndex={-1} className="flex items-center justify-center ml-2 rounded-full" >
                                    <Info className="w-4 h-4 text-chart-5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-primary text-foreground p-2 rounded " >
                                The website URL you want to block (e.g. https://facebook.com).
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <Input
                    ref={websiteInputRef}
                    className='mt-2'
                    id="websiteName"
                    value={websiteValue}
                    placeholder="Enter website URL"
                    onChange={(e) => setWebsiteValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            addGlobalTimeBudgetWebsite(); // Trigger the button click action
                        }
                    }}
                />
                {!isValidWebsite && <p className="text-red-500 text-sm mt-2">Invalid URL</p>}
            </div>

            <div className='w-full text-right mb-2'>
                <Button className="mt-8" onClick={addGlobalTimeBudgetWebsite}> Add Website </Button>
            </div>

        </div >

    );
};

