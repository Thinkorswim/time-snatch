import { useState, useEffect, useRef, } from 'react';
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Check, Info, Plus, X } from "lucide-react";
import { Button } from '@/components/ui/button';
import { BlockedWebsite } from '@/models/BlockedWebsite';
import { validateURL, extractHostnameAndDomain, updateObjectKeyAndData, numberToDay, timeDisplayFormat } from '@/lib/utils';
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
            timeAllowed: { 0: 300, 1: 300, 2: 300, 3: 300, 4: 300, 5: 300, 6: 300 },
            totalTime: 0,
            blockIncognito: false,
            variableSchedule: false,
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

    const [isVariableScheduleEnabled, setIsVariableScheduleEnabled] = useState(initialBlockedWebsiteData.variableSchedule);
    const [selectedDay, setSelectedDay] = useState<number>(0);
    const [timeAllowed, setTimeAllowed] = useState<{ [key: string]: number; }>(initialBlockedWebsiteData.timeAllowed);

    const [timeAllowedMinutes, setTimeAllowedMinutes] = useState<ISettingsPointer[]>([
        {
            value: Math.floor(initialBlockedWebsiteData.timeAllowed[selectedDay] % 3600 / 60),
            radius: 12,
            bgColor: "#fff",
            bgColorSelected: '#eee',
        }
    ]);

    const [timeAllowedHours, setTimeAllowedHours] = useState<ISettingsPointer[]>([
        {
            value: Math.floor(initialBlockedWebsiteData.timeAllowed[selectedDay] / 3600),
            radius: 12,
            bgColor: "#fff",
            bgColorSelected: '#eee',
        }
    ]);

    const [scheduleTimesArray, setScheduleTimesArray] = useState<ISettingsPointer[][]>(
        initialScheduleEnabled && initialBlockedWebsiteData.scheduledBlockRanges.length
            ? initialBlockedWebsiteData.scheduledBlockRanges.map(range => ([
                { value: range.start - 360, radius: 12, bgColor: "#fff", bgColorSelected: '#eee' },
                { value: range.end - 360, radius: 12, bgColor: "#fff", bgColorSelected: '#eee' },
            ]))
            : [[
                { value: 180, radius: 12, bgColor: "#fff", bgColorSelected: '#eee' },
                { value: 660, radius: 12, bgColor: "#fff", bgColorSelected: '#eee' },
            ]]
    );

    const [scheduleDaysArray, setScheduleDaysArray] = useState<boolean[][]>(
        initialScheduleEnabled && initialBlockedWebsiteData.scheduledBlockRanges.length
            ? initialBlockedWebsiteData.scheduledBlockRanges.map(range => range.days)
            : [[true, true, true, true, true, true, true]]
    );

    const handleVariableScheduleEnabledChange = (checked: boolean) => {
        if (!checked) {
            setSelectedDay(0);

            setTimeAllowedMinutes([
                {
                    value: Math.floor(timeAllowed[1] % 3600 / 60),
                    radius: 12,
                    bgColor: "#fff",
                    bgColorSelected: '#eee',
                }
            ]);
            setTimeAllowedHours([
                {
                    value: Math.floor(timeAllowed[1] / 3600),
                    radius: 12,
                    bgColor: "#fff",
                    bgColorSelected: '#eee',
                }
            ]);
            setTimeAllowed(
                {
                    0: timeAllowed[1],
                    1: timeAllowed[1],
                    2: timeAllowed[1],
                    3: timeAllowed[1],
                    4: timeAllowed[1],
                    5: timeAllowed[1],
                    6: timeAllowed[1]
                }
            );
        }

        setIsVariableScheduleEnabled(checked);
    };

    const handleVariableDayDisabled = (disable: boolean) => {
        if (disable) {
            const newTimeAllowed = { ...timeAllowed };
            newTimeAllowed[selectedDay] = -1;
            setTimeAllowed(newTimeAllowed);
        } else {
            const newTimeAllowed = { ...timeAllowed };
            newTimeAllowed[selectedDay] = 300;
            setTimeAllowed(newTimeAllowed);
            setTimeAllowedMinutes([
                {
                    value: Math.floor(300 % 3600 / 60),
                    radius: 12,
                    bgColor: "#fff",
                    bgColorSelected: '#eee',
                }
            ]);
            setTimeAllowedHours([
                {
                    value: Math.floor(300 / 3600),
                    radius: 12,
                    bgColor: "#fff",
                    bgColorSelected: '#eee',
                }
            ]);
        }
    };

    const handleMinutesChange = (value: ISettingsPointer[]) => {
        if (isVariableScheduleEnabled) {
            const currentTimeAllowed = timeAllowed[selectedDay]
            const newTimeAllowed = { ...timeAllowed };
            newTimeAllowed[selectedDay] = value[0].value as number * 60 + (currentTimeAllowed - currentTimeAllowed % 3600);
            setTimeAllowed(newTimeAllowed);
        } else {
            const currentTimeAllowed = timeAllowed[selectedDay]
            const newTimeAllowed = { ...timeAllowed };
            for (let day = 0; day < 7; day++) {
                newTimeAllowed[day] = value[0].value as number * 60 + Math.floor(currentTimeAllowed / 3600);
            }
            setTimeAllowed(newTimeAllowed);
        }

        setTimeAllowedMinutes(value);
    };

    const handleHoursChange = (value: ISettingsPointer[]) => {
        if (isVariableScheduleEnabled) {
            const currentTimeAllowed = timeAllowed[selectedDay]
            const newTimeAllowed = { ...timeAllowed };
            newTimeAllowed[selectedDay] = (value[0].value as number * 3600) + (currentTimeAllowed % 3600);
            setTimeAllowed(newTimeAllowed);
        }
        else {
            const currentTimeAllowed = timeAllowed[selectedDay]
            const newTimeAllowed = { ...timeAllowed };
            for (let day = 0; day < 7; day++) {
                newTimeAllowed[day] = (value[0].value as number * 3600) + (currentTimeAllowed % 3600);
            }
            setTimeAllowed(newTimeAllowed);
        }
        setTimeAllowedHours(value);
    }

    // Method to add new intervals
    const addScheduleRange = () => {
        setScheduleTimesArray(prev => [
            ...prev,
            [
                { value: 180, radius: 12, bgColor: "#fff", bgColorSelected: '#eee' },
                { value: 660, radius: 12, bgColor: "#fff", bgColorSelected: '#eee' }
            ]
        ]);
        setScheduleDaysArray(prev => [...prev, [true, true, true, true, true, true, true]]);
    };

    // Method to remove intervals
    const removeScheduleRange = (index: number) => {
        setScheduleTimesArray(prev => prev.filter((_, i) => i !== index));
        setScheduleDaysArray(prev => prev.filter((_, i) => i !== index));
    };

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
            timeAllowed,
            isIncognitoEnabled,
            isVariableScheduleEnabled,
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
            blockedWebsite.scheduledBlockRanges = scheduleTimesArray.map((pair, idx) => ({
                start: (pair[0].value as number + 360) % 1440,
                end: (pair[1].value as number + 360) % 1440,
                days: scheduleDaysArray[idx]
            }));
        }

        browser.storage.local.get("blockedWebsitesList", (data) => {
            const currentList = data.blockedWebsitesList || {};
            const realUrl = extractHostnameAndDomain(websiteValue)!;

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
                    [realUrl]: blockedWebsite.toJSON(),
                };
            }

            browser.storage.local.set({ blockedWebsitesList: updatedList }, () => {
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
                setScheduleTimesArray([[{ value: 180 }, { value: 660 }]]);
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

            <div className="mt-5 flex items-center justify-between max-w-[250px]">
                <div className="flex items-center">
                    <Label htmlFor="variable-schedule-enabled">Variable Schedule</Label>
                    <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild >
                                <button className="flex items-center justify-center ml-2 rounded-full" >
                                    <Info className="w-4 h-4 text-chart-5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-primary text-foreground p-2 rounded" >
                                Adjust the schedule for specific days of the week.
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <Switch
                    className="ml-2"
                    id="variable-schedule-enabled"
                    checked={isVariableScheduleEnabled}
                    onCheckedChange={handleVariableScheduleEnabledChange}
                />
            </div>
            {isVariableScheduleEnabled && (

                <div className="flex flex-wrap justify-center my-5">
                    {Array.from({ length: 7 }, (_, i) => {
                        const dayIndex = i; // Adjust the index to start from 1
                        return (
                            <div key={dayIndex} className="flex flex-col items-center mx-1">
                                <div
                                    className={
                                        dayIndex === selectedDay
                                            ? "w-8 h-8 m-1 flex items-center justify-center rounded-full cursor-pointer bg-primary text-muted-foreground select-none"
                                            : "w-8 h-8 m-1 flex items-center justify-center rounded-full cursor-pointer bg-background text-muted-foreground select-none"
                                    }
                                    onClick={() => {
                                        setSelectedDay(dayIndex);
                                        setTimeAllowedMinutes([
                                            {
                                                value: Math.floor(timeAllowed[dayIndex] % 3600 / 60),
                                                radius: 12,
                                                bgColor: "#fff",
                                                bgColorSelected: '#eee',
                                            }
                                        ]);
                                        setTimeAllowedHours([
                                            {
                                                value: Math.floor(timeAllowed[dayIndex] / 3600),
                                                radius: 12,
                                                bgColor: "#fff",
                                                bgColorSelected: '#eee',
                                            }
                                        ]);
                                    }}
                                >
                                    {['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'][i]}
                                </div>
                                <div className="mt-1 text-sm">
                                    {timeDisplayFormat(timeAllowed[dayIndex], true)}
                                </div>
                            </div>
                        );
                    })}
                </div>

            )}

            {!isVariableScheduleEnabled && (
                <div className="mt-5 flex items-center" >
                    <Label htmlFor="name">  Time Allowed Per Day </Label>
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
            )}

            {timeAllowed[selectedDay] !== -1 && (
                <div className="mx-14">
                    <div ref={parentRef} className="w-full relative">
                        <RoundSlider
                            pointers={timeAllowedMinutes}
                            onChange={handleMinutesChange}
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
                                onChange={handleHoursChange}
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
                                            style={{ MozAppearance: 'textfield' }}
                                            value={String(timeAllowedHours[0].value).padStart(2, '0')}
                                            onChange={(e) => handleHoursChange([{ value: Math.min(Number(e.target.value), 10) }])}
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
                                            style={{ MozAppearance: 'textfield' }}
                                            value={String(timeAllowedMinutes[0].value).padStart(2, '0')}
                                            onChange={(e) => handleMinutesChange([{ value: Math.min(Number(e.target.value), 59) }])}
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
            )}

            {isVariableScheduleEnabled && (
                <div className='mt-5 flex items-center justify-center'>
                    {
                        timeAllowed[selectedDay] === -1 ? (
                            <>
                                <Button onClick={() => handleVariableDayDisabled(false)}>Enable on {numberToDay(selectedDay)}s</Button>
                            </>
                        ) : (
                            <>
                                <Button onClick={() => handleVariableDayDisabled(true)}>Disable on {numberToDay(selectedDay)}s</Button>
                            </>
                        )
                    }
                </div >
            )
            }

            <div className="mt-5">
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
                        <>
                            {scheduleTimesArray.map((pair, index) => (
                                <div key={index} className="mx-14 mb-5 mt-3 relative">
                                    <div className='left-[17px] relative'>
                                        <RoundSlider
                                            pointers={pair}
                                            onChange={(updated) => {
                                                setScheduleTimesArray(prev => {
                                                    const copy = [...prev];
                                                    copy[index] = updated;
                                                    return copy;
                                                });
                                            }}
                                            hideText={true}
                                            pathRadius={pathRadius - 20}
                                            pathThickness={12}
                                            pathBgColor={secondaryColor}
                                            connectionBgColor={primaryColor}
                                            pointerBgColor={"#fff"}
                                            pointerBgColorSelected={"#fff"}
                                            min={0}
                                            max={1440}
                                        />
                                    </div>
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: "22%",
                                            left: "50%",
                                            transform: "translateX(-50%)",
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <div>
                                            <div className='mb-2'>Block From</div>
                                            <div className="flex items-center">
                                                <label className="flex items-center">
                                                    <Input
                                                        className='w-12 no-arrows text-center'
                                                        type="number"
                                                        style={{ MozAppearance: 'textfield' }}
                                                        value={String(Math.floor((pair[0].value as number + 360) % 1440 / 60)).padStart(2, '0')}
                                                        onChange={(e) => {
                                                            const h = Math.min(Number(e.target.value), 23);
                                                            const m = (pair[0].value as number + 360) % 60;
                                                            const newValue = ((h * 60) + m - 360) % 1440;
                                                            setScheduleTimesArray(prev => {
                                                                const copy = [...prev];
                                                                copy[index] = [{ ...pair[0], value: newValue }, pair[1]];
                                                                return copy;
                                                            });
                                                        }}
                                                        min={0}
                                                        max={23}
                                                        onFocus={(e) => e.target.select()}
                                                    />
                                                </label>
                                                <label className="ml-2 flex items-center">
                                                    <Input
                                                        className='w-12 no-arrows text-center'
                                                        type="number"
                                                        style={{ MozAppearance: 'textfield' }}
                                                        value={String((pair[0].value as number + 360) % 60).padStart(2, '0')}
                                                        onChange={(e) => {
                                                            const m = Math.min(Number(e.target.value), 59);
                                                            const h = Math.floor((pair[0].value as number) / 60);
                                                            const newValue = ((h * 60) + m) % 1440;
                                                            setScheduleTimesArray(prev => {
                                                                const copy = [...prev];
                                                                copy[index] = [{ ...pair[0], value: newValue }, pair[1]];
                                                                return copy;
                                                            });
                                                        }}
                                                        min={0}
                                                        max={59}
                                                        onFocus={(e) => e.target.select()}
                                                    />
                                                </label>
                                            </div>
                                            <div className='mt-2 mb-2'>Until</div>
                                            <div className="flex items-center">
                                                <label className="flex items-center">
                                                    <Input
                                                        className='w-12 no-arrows text-center'
                                                        type="number"
                                                        style={{ MozAppearance: 'textfield' }}
                                                        value={String(Math.floor((pair[1].value as number + 360) % 1440 / 60)).padStart(2, '0')}
                                                        onChange={(e) => {
                                                            const h = Math.min(Number(e.target.value), 23);
                                                            const m = (pair[1].value as number + 360) % 60;
                                                            const newValue = ((h * 60) + m - 360) % 1440;
                                                            setScheduleTimesArray(prev => {
                                                                const copy = [...prev];
                                                                copy[index] = [pair[0], { ...pair[1], value: newValue }];
                                                                return copy;
                                                            });
                                                        }}
                                                        min={0}
                                                        max={23}
                                                        onFocus={(e) => e.target.select()}
                                                    />
                                                </label>
                                                <label className="ml-2 flex items-center">
                                                    <Input
                                                        className='w-12 no-arrows text-center'
                                                        type="number"
                                                        style={{ MozAppearance: 'textfield' }}
                                                        value={String((pair[1].value as number + 360) % 60).padStart(2, '0')}
                                                        onChange={(e) => {
                                                            const m = Math.min(Number(e.target.value), 59);
                                                            const h = Math.floor((pair[1].value as number) / 60);
                                                            const newValue = ((h * 60) + m) % 1440;
                                                            setScheduleTimesArray(prev => {
                                                                const copy = [...prev];
                                                                copy[index] = [pair[0], { ...pair[1], value: newValue }];
                                                                return copy;
                                                            });
                                                        }}
                                                        min={0}
                                                        max={59}
                                                        onFocus={(e) => e.target.select()}
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap justify-center mt-2 ml-5">
                                        {['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'].map((label, i) => {
                                            const isActive = scheduleDaysArray[index][i];
                                            return (
                                                <div key={i} className="relative flex flex-col items-center">
                                                    <div
                                                        className={
                                                            isActive
                                                                ? "w-8 h-8 m-1 flex items-center justify-center rounded-full cursor-pointer bg-primary text-muted-foreground select-none"
                                                                : "w-8 h-8 m-1 flex items-center justify-center rounded-full cursor-pointer bg-background text-muted-foreground select-none"
                                                        }
                                                        onClick={() => {
                                                            const newDays = [...scheduleDaysArray[index]];
                                                            newDays[i] = !newDays[i];
                                                            setScheduleDaysArray(prev => {
                                                                const copy = [...prev];
                                                                copy[index] = newDays;
                                                                return copy;
                                                            });
                                                        }}
                                                    >
                                                        {label}
                                                    </div>
                                                    {isActive ? (
                                                        <Check className="w-4 h-4 text-muted-foreground mt" />
                                                    ) : (
                                                        <X className="w-4 h-4 text-muted-foreground mt" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                        <div className='mt-3'>
                                            <TooltipProvider>
                                                <Tooltip delayDuration={0}>
                                                    <TooltipTrigger asChild >
                                                        <button className="flex items-center justify-center ml-2 rounded-full" >
                                                            <Info className="w-4 h-4 text-chart-5" />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-primary text-foreground p-2 rounded border-1" >
                                                        Select the days of the week this interval applies to.
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </div>

                                    {index > 0 && (
                                        <div className='w-full text-center mt-3'>
                                            <Button onClick={() => removeScheduleRange(index)}> <X className='h-5 w-5 mr-1' /> Remove Interval</Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div className='w-full text-center '>
                                <Button className="" onClick={addScheduleRange}> <Plus className='h-5 w-5 mr-1' />  Additional Interval</Button>
                            </div>
                        </>
                    )}
            </div>

            <div className='w-full text-right mb-2'>
                <Button className="mt-8" onClick={addBlockedWebsite}>  {blockedWebsiteProp ? "Save Website" : "Block Website"} </Button>
            </div>

        </div >

    );
};

