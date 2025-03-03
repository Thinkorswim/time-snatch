import { useState, useEffect, useRef, } from 'react';
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react";
import { Button } from '@/components/ui/button';
import { BlockedWebsite } from '@/lib/BlockedWebsite';
import { validateURL, extractHostnameAndDomain, updateObjectKeyAndData } from '@/lib/utils';
import { RoundSlider, ISettingsPointer } from 'mz-react-round-slider';

interface BlockedWebsiteFormProps {
    callback?: () => void; // Generic optional callback
    blockedWebsiteProp?: BlockedWebsite | null; // Optional blocked website to edit
}

export const BlockedWebsiteForm: React.FC<BlockedWebsiteFormProps> = ({ callback, blockedWebsiteProp }) => {
    let initialBlockedWebsiteData: BlockedWebsite;
    let initialScheduleEnabled = false;

    if (blockedWebsiteProp) {
        initialBlockedWebsiteData = blockedWebsiteProp;
        initialScheduleEnabled = blockedWebsiteProp.scheduledBlockRanges.length > 0;
    } else {
        initialBlockedWebsiteData = BlockedWebsite.fromJSON({
            website: "",
            timeAllowed: 300,
            totalTime: 0,
            blockIncognito: false,
            redirectUrl: "",
            lastAccessedDate: new Date().toLocaleDateString('en-CA').slice(0, 10),
            scheduledBlockRanges: [],
        });
    }

    const [websiteValue, setWebsiteValue] = useState(initialBlockedWebsiteData.website);
    const [isValidWebsite, setIsValidWebsite] = useState(true);

    const [isIncognitoEnabled, setIsIncognitoEnabled] = useState(initialBlockedWebsiteData.blockIncognito);

    const [isRedirectEnabled, setIsRedirectEnabled] = useState(initialBlockedWebsiteData.redirectUrl !== "");
    const [redirectValue, setRedirectValue] = useState(initialBlockedWebsiteData.redirectUrl);
    const [isValidRedirect, setIsValidRedirect] = useState(true);

    const [isScheduleEnabled, setIsScheduleEnabled] = useState(initialScheduleEnabled);

    const [primaryColor, setPrimaryColor] = useState('');
    const [secondaryColor, setSecondaryColor] = useState('');

    const [pathRadius, setPathRadius] = useState<number>(0);
    const parentRef = useRef<HTMLDivElement | null>(null);

    const websiteInputRef = useRef<HTMLInputElement | null>(null);
    const redirectInputRef = useRef<HTMLInputElement | null>(null);

    const [timeAllowedMinutes, setTimeAllowedMinutes] = useState<ISettingsPointer[]>([
        {
            value: Math.floor(initialBlockedWebsiteData.timeAllowed % 3600 / 60),
            radius: 12,
            bgColor: "#fff",
            bgColorSelected: '#eee',
        }
    ]);


    const [timeAllowedHours, setTimeAllowedHours] = useState<ISettingsPointer[]>([
        {
            value: Math.floor(initialBlockedWebsiteData.timeAllowed / 3600),
            radius: 12,
            bgColor: "#fff",
            bgColorSelected: '#eee',
        }
    ]);

    const [scheduleTimes, setScheduleTimes] = useState<ISettingsPointer[]>([
        {
            value: initialScheduleEnabled ? initialBlockedWebsiteData.scheduledBlockRanges[0].start : 180,
            radius: 12,
            bgColor: "#fff",
            bgColorSelected: '#eee',
        },
        {
            value: initialScheduleEnabled ? initialBlockedWebsiteData.scheduledBlockRanges[0].end : 660,
            radius: 12,
            bgColor: "#fff",
            bgColorSelected: '#eee',
        }
    ]);

    // Handle resizing of the circular sliders
    useEffect(() => {
        const updatePathRadius = () => {
            if (parentRef.current) {
                const parentWidth = parentRef.current.offsetWidth;
                setPathRadius((parentWidth - 20) / 2);
            }
        };
        updatePathRadius();
        window.addEventListener('resize', updatePathRadius);
        return () => {
            window.removeEventListener('resize', updatePathRadius);
        };
    }, []);

    // Get the colors from CSS variables
    useEffect(() => {
        const root = document.documentElement;
        const primary = getComputedStyle(root).getPropertyValue('--primary').trim().split(' ');
        setPrimaryColor("hsl(" + primary[0] + "," + primary[1] + "," + primary[2] + ")");

        const secondary = getComputedStyle(root).getPropertyValue('--background').trim().split(' ');
        setSecondaryColor("hsl(" + secondary[0] + "," + secondary[1] + "," + secondary[2] + ")");
    }, []);

    // Add the blocked website to storage
    const addBlockedWebsite = () => {
        let blockedWebsite = new BlockedWebsite(
            websiteValue,
            (timeAllowedMinutes[0].value as number * 60) + (timeAllowedHours[0].value as number * 3600),
            isIncognitoEnabled,
            redirectValue
        );

        blockedWebsite.totalTime = initialBlockedWebsiteData.totalTime;

        if (!validateURL(websiteValue)) {
            setIsValidWebsite(false);
            websiteInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            websiteInputRef.current?.focus();
            return;
        } else {
            const realUrl = extractHostnameAndDomain(websiteValue);
            if (realUrl) {
                blockedWebsite.website = realUrl;
            } else {
                setIsValidWebsite(false);     
                websiteInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                websiteInputRef.current?.focus();
                return;
            }
        }

        if (isRedirectEnabled) {
            if (!validateURL(redirectValue)) {
                setIsValidRedirect(false);
                redirectInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                redirectInputRef.current?.focus();
                return;
            }
        } else {
            blockedWebsite.redirectUrl = "";
        }

        if (isScheduleEnabled) {
            blockedWebsite.scheduledBlockRanges = [
                {
                    start: (scheduleTimes[0].value as number + 360) % 1440,
                    end: (scheduleTimes[1].value as number + 360) % 1440,
                }
            ]
        }

        chrome.storage.local.get("blockedWebsitesList", (data) => {
            const currentList = data.blockedWebsitesList || {};

            let updatedList = {};

            if (blockedWebsiteProp && blockedWebsiteProp.website !== blockedWebsite.website) {
                updatedList = updateObjectKeyAndData(
                    currentList,
                    blockedWebsiteProp.website,
                    blockedWebsite.website,
                    blockedWebsite.toJSON()
                )
            } else {
                updatedList = {
                    ...currentList,
                    [websiteValue]: blockedWebsite.toJSON(),
                };    
            }

            chrome.storage.local.set({ blockedWebsitesList: updatedList }, () => {
                // Close the dialog
                if (callback) {
                    callback();
                }

                // Clear the form
                setWebsiteValue("");
                setIsValidWebsite(true);
                setIsIncognitoEnabled(false);
                setIsRedirectEnabled(false);
                setRedirectValue("");
                setIsValidRedirect(true);
                setIsScheduleEnabled(false);
                setTimeAllowedMinutes([{ value: 5 }]);
                setTimeAllowedHours([{ value: 0 }]);
                setScheduleTimes([{ value: 180 }, { value: 660 }]);
            });
        });
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
                <Input ref={websiteInputRef} className='mt-2' id="websiteName" value={websiteValue} placeholder="Enter website URL" onChange={(e) => setWebsiteValue(e.target.value)} />
                {!isValidWebsite && <p className="text-red-500 text-sm mt-2">Invalid URL</p>}
            </div>

            <div className="mt-5 flex items-center" >
                <Label htmlFor="name"> Time Allowed Per Day </Label>
                <TooltipProvider>
                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild >
                            <button className="flex items-center justify-center ml-2 rounded-full" >
                                <Info className="w-4 h-4 text-chart-5" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-primary text-foreground p-2 rounded " >
                            When this time is up, the website will be blocked for the rest of the day. <br /> Set to 00:00 to block the website completely.
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <div className="mx-14">
                <div ref={parentRef} className="w-full relative">
                    <RoundSlider
                        pointers={timeAllowedMinutes}
                        onChange={setTimeAllowedMinutes}
                        hideText={true}
                        pathRadius={pathRadius}
                        pathStartAngle={270}
                        pathEndAngle={269.999}
                        pathThickness={12}
                        pathBgColor={secondaryColor}
                        connectionBgColor={primaryColor}
                        pointerBgColor={"#fff"}
                        pointerBgColorSelected={"#fff"}
                        min={0}
                        max={59}
                    />
                    <div style={{
                        position: "absolute",
                        top: "20px",
                        left: "20px",
                        clipPath: `circle(${pathRadius - 8}px at 50% 50%)`,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                    }}>
                        <RoundSlider
                            pointers={timeAllowedHours}
                            onChange={setTimeAllowedHours}
                            hideText={true}
                            pathRadius={pathRadius - 20}
                            pathStartAngle={270}
                            pathEndAngle={269.999}
                            pathThickness={12}
                            pathBgColor={secondaryColor}
                            connectionBgColor={primaryColor}
                            pointerBgColor={"#fff"}
                            pointerBgColorSelected={"#fff"}
                            min={0}
                            max={10}
                        />
                    </div>
                    <div className="" style={{
                        position: "absolute",
                        top: "45%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                    }}>
                        <div className="flex items-center">
                            <div>
                                <label className="flex items-center">
                                    <Input
                                        className='w-12 no-arrows text-center'
                                        type="number"
                                        value={String(timeAllowedHours[0].value).padStart(2, '0')}
                                        onChange={(e) => setTimeAllowedHours([{ value: Math.min(Number(e.target.value), 10) }])}
                                        min={0}
                                        max={10}
                                        onFocus={(e) => e.target.select()}
                                    />
                                    <div className='ml-1'>
                                        hours
                                    </div>
                                </label>
                            </div>
                            <div className='ml-2'>
                                <label className="flex items-center">
                                    <Input
                                        className='w-12 no-arrows text-center'
                                        type="number"
                                        value={String(timeAllowedMinutes[0].value).padStart(2, '0')}
                                        onChange={(e) => setTimeAllowedMinutes([{ value: Math.min(Number(e.target.value), 59) }])}
                                        min={0}
                                        max={59}
                                        onFocus={(e) => e.target.select()}
                                    />
                                    <div className='ml-1'>
                                        mins
                                    </div>
                                </label>
                            </div>
                        </div>
                        {timeAllowedHours[0].value === 0 && timeAllowedMinutes[0].value === 0 && (
                            <div className='mt-3'>
                                <Label>Blocked</Label>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-8">
                <div className="flex items-center justify-between max-w-[250px]" >
                    <div className="flex items-center" >
                        <Label htmlFor="redirect-enabled"> Redirect </Label>
                        <TooltipProvider>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild >
                                    <button className="flex items-center justify-center ml-2 rounded-full" >
                                        <Info className="w-4 h-4 text-chart-5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-primary text-foreground p-2 rounded " >
                                    Redirect to a specific website when the blocked website is accessed. <br /> Leave blank to redirect to an inspirational quote.
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <Switch
                        className="ml-2"
                        id="redirect-enabled"
                        checked={isRedirectEnabled}
                        onCheckedChange={(checked) => setIsRedirectEnabled(checked)}
                    />
                </div>
                {
                    isRedirectEnabled && (
                        <>
                            <Input
                                className="mt-2"
                                id="redirect"
                                value={redirectValue}
                                ref={redirectInputRef}
                                placeholder="Enter website URL"
                                onChange={(e) => setRedirectValue(e.target.value)}
                            />
                            {!isValidRedirect && (
                                <p className="text-red-500 text-sm mt-2">Invalid URL</p>
                            )}
                        </>
                    )
                }
            </div>


            <div className="mt-5 flex items-center justify-between max-w-[250px]">
                <div className="flex items-center" >
                    <Label htmlFor="incognito-enabled"> Block in Incognito </Label>
                    <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild >
                                <button className="flex items-center justify-center ml-2 rounded-full" >
                                    <Info className="w-4 h-4 text-chart-5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-primary text-foreground p-2 rounded " >
                                You need to enable the extension in incognito mode for this to work as shown <a className='text-blue-500' href="https://www.itsupportguides.com/knowledge-base/google-chrome/google-chrome-how-to-enable-extensions-in-incognito/">here</a>.
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <Switch
                    className="ml-2"
                    id="incognito-enabled"
                    checked={isIncognitoEnabled}
                    onCheckedChange={(checked) => setIsIncognitoEnabled(checked)}
                />
            </div>


            <div className="mt-5">
                <div className="flex items-center justify-between max-w-[250px]" >
                    <div className="flex items-center" >
                        <Label htmlFor="nuke-enabled"> Scheduled Block </Label>
                        <TooltipProvider>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild >
                                    <button className="flex items-center justify-center ml-2 rounded-full" >
                                        <Info className="w-4 h-4 text-chart-5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-primary text-foreground p-2 rounded " >
                                    Block the website completely during specific intervals of the day.
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    < Switch
                        className="ml-2"
                        id="nuke-enabled"
                        checked={isScheduleEnabled}
                        onCheckedChange={(checked) => setIsScheduleEnabled(checked)}
                    />
                </div>
                {
                    isScheduleEnabled && (
                        <div className="mx-14 mt-5">
                            <div ref={parentRef} className="w-full relative">
                                <RoundSlider
                                    pointers={scheduleTimes}
                                    onChange={setScheduleTimes}
                                    hideText={true}
                                    pathRadius={pathRadius}
                                    pathThickness={12}
                                    pathBgColor={secondaryColor}
                                    connectionBgColor={primaryColor}
                                    pointerBgColor={"#fff"}
                                    pointerBgColorSelected={"#fff"}
                                    min={0}
                                    max={1440}
                                />
                                <div className="" style={{
                                    position: "absolute",
                                    top: "28%",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}>
                                    <div>
                                        <div className='mb-1'>
                                            Start Time
                                        </div>
                                        <div className="flex items-center">
                                            <label className="flex items-center">
                                                <Input
                                                    className='w-12 no-arrows text-center'
                                                    type="number"
                                                    value={String(Math.floor((scheduleTimes[0].value as number + 360) % 1440 / 60)).padStart(2, '0')}
                                                    onChange={(e) => {
                                                        const minutes = ((scheduleTimes[0].value as number + 360) % 60);
                                                        const hours = Math.min(Number(e.target.value), 23);
                                                        const newValue = ((hours * 60 + minutes) - 360) % 1440;

                                                        setScheduleTimes([{ ...scheduleTimes[0], value: newValue }, scheduleTimes[1]]);
                                                    }}
                                                    min={0}
                                                    max={23}
                                                    onFocus={(e) => e.target.select()}
                                                />
                                            </label>
                                            <label className="flex items-center ml-2">
                                                <Input
                                                    className='w-12 no-arrows text-center'
                                                    type="number"
                                                    value={String((scheduleTimes[0].value as number + 360) % 60).padStart(2, '0')}
                                                    onChange={(e) => {
                                                        const minutes = Math.min(Number(e.target.value), 59);
                                                        const hours = Math.floor((scheduleTimes[0].value as number) / 60);
                                                        const newValue = ((hours * 60 + minutes)) % 1440;
                                                        setScheduleTimes([{ ...scheduleTimes[0], value: newValue }, scheduleTimes[1]]);
                                                    }}
                                                    min={0}
                                                    max={59}
                                                    onFocus={(e) => e.target.select()}
                                                />
                                            </label>
                                        </div>
                                        <div className='mt-4 mb-1'>
                                            End Time
                                        </div>
                                        <div className="flex items-center">
                                            <label className="flex items-center">
                                                <Input
                                                    className='w-12 no-arrows text-center'
                                                    type="number"
                                                    value={String(Math.floor((scheduleTimes[1].value as number + 360) % 1440 / 60)).padStart(2, '0')}
                                                    onChange={(e) => {
                                                        const minutes = ((scheduleTimes[1].value as number + 360) % 60);
                                                        const hours = Math.min(Number(e.target.value), 23);
                                                        const newValue = ((hours * 60 + minutes) - 360) % 1440;

                                                        setScheduleTimes([scheduleTimes[0], { ...scheduleTimes[1], value: newValue }]);
                                                    }}
                                                    min={0}
                                                    max={23}
                                                    onFocus={(e) => e.target.select()}
                                                />
                                            </label>
                                            <label className="flex items-center ml-2">
                                                <Input
                                                    className='w-12 no-arrows text-center'
                                                    type="number"
                                                    value={String((scheduleTimes[1].value as number + 360) % 60).padStart(2, '0')}
                                                    onChange={(e) => {
                                                        const minutes = Math.min(Number(e.target.value), 59);
                                                        const hours = Math.floor((scheduleTimes[1].value as number) / 60);
                                                        const newValue = ((hours * 60 + minutes)) % 1440;
                                                        setScheduleTimes([scheduleTimes[0], { ...scheduleTimes[1], value: newValue }]);
                                                    }}
                                                    min={0}
                                                    max={59}
                                                    onFocus={(e) => e.target.select()}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    )}
            </div>

            <div className='w-full text-right mb-2'>
                <Button className="mt-8" onClick={addBlockedWebsite}> {blockedWebsiteProp ? "Save Website" : "Block Website"} </Button>
            </div>

        </div >

    );
};

