import { useState, useRef } from 'react';
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react";
import { Button } from '@/components/ui/button';
import { validateURL, extractHostnameAndDomain, hasSubdomain, extractHighLevelDomain } from '@/lib/utils';
import { t, useLocale } from "@/lib/i18n";
import { syncGroupBudgetsBg, type GroupBudgetRecord } from '@/lib/sync';

interface GlobalTimeBudgetWebsiteFormProps {
    callback?: () => void;
    budgetId: string;
}

export const GlobalTimeBudgetWebsiteForm: React.FC<GlobalTimeBudgetWebsiteFormProps> = ({ callback, budgetId }) => {
    useLocale();
    const [websiteValue, setWebsiteValue] = useState("");
    const [websiteSubDomainInfo, setWebsiteSubDomainInfo] = useState<React.ReactNode>(null);
    const [isValidWebsite, setIsValidWebsite] = useState(true);

    const websiteInputRef = useRef<HTMLInputElement | null>(null);

    const addGlobalTimeBudgetWebsite = async () => {
        if (!validateURL(websiteValue)) {
            setIsValidWebsite(false);
            websiteInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            websiteInputRef.current?.focus();
            return;
        }

        const realUrl = extractHostnameAndDomain(websiteValue);
        if (!realUrl) {
            setIsValidWebsite(false);
            websiteInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            websiteInputRef.current?.focus();
            return;
        }

        const result = (await browser.storage.local.get('groupBudgets')) as { groupBudgets?: GroupBudgetRecord[] };
        const budgets = Array.isArray(result.groupBudgets) ? result.groupBudgets : [];

        const now = new Date().toISOString();
        const updated = budgets.map((g) => {
            if (g.id !== budgetId) return g;
            // Dedupe — adding an existing website is a no-op.
            const websites = g.websites.includes(realUrl) ? g.websites : [...g.websites, realUrl];
            return { ...g, websites, updatedAt: now, syncedAt: null };
        });

        await browser.storage.local.set({ groupBudgets: updated });
        syncGroupBudgetsBg();

        if (callback) callback();
    };

    const handleWebsiteInput = (e: React.FocusEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        setWebsiteValue(inputValue);
        const domain = extractHostnameAndDomain(inputValue);
        if (inputValue && hasSubdomain(inputValue)) {
            setWebsiteSubDomainInfo(
                <>
                    {t('form.subdomainInfoPre')} <span className='font-bold'>{domain}</span> {t('form.subdomainInfoMid')} <span className='font-bold'>{extractHighLevelDomain(inputValue)}</span> {t('form.subdomainInfoPost')}
                </>
            );
        } else {
            setWebsiteSubDomainInfo(null);
        }
    };

    return (
        <div className="w-[99%] mx-auto">
            <div className="mt-5">
                <div className="mt-5 flex items-center" >
                    <Label htmlFor="websiteName"> {t('form.website')} </Label>
                    <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild >
                                <button tabIndex={-1} className="flex items-center justify-center ml-2 rounded-full" >
                                    <Info className="w-4 h-4 text-chart-5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-primary text-foreground p-2 rounded " >
                                {t('form.websiteTooltip')}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <Input
                    ref={websiteInputRef}
                    className='mt-2'
                    id="websiteName"
                    value={websiteValue}
                    placeholder={t('form.websitePlaceholder')}
                    onChange={handleWebsiteInput}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') addGlobalTimeBudgetWebsite();
                    }}
                />
                {!isValidWebsite && <p className="text-red-500 text-sm mt-2">{t('form.invalidUrl')}</p>}
                {websiteSubDomainInfo && <p className="text-sm mt-2">{websiteSubDomainInfo}</p>}
            </div>

            <div className='w-full text-right mb-2'>
                <Button className="mt-8" onClick={addGlobalTimeBudgetWebsite}> {t('form.addWebsiteButton')} </Button>
            </div>
        </div >
    );
};
