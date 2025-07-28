import { useState, useEffect } from 'react'
import './style.css';
import '~/assets/global.css';
import { BlockedWebsite } from "@/models/BlockedWebsite"
import { BlockedWebsiteForm } from "@/components/custom/BlockedWebsiteForm"
import { BlockedWebsitesTable } from '@/components/custom/BlockedWebsitesTable'
import { GlobalTimeBudgetTable } from '@/components/custom/GlobalTimeBudgetTable'
import { GlobalTimeBudgetForm } from '@/components/custom/GlobalTimeBudgetForm'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Pencil, Info, ShieldBan, Component, Activity, Dot, UserCog, Settings, ChartNoAxesColumn } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GlobalTimeBudget } from '@/models/GlobalTimeBudget'
import { timeDisplayFormat, scheduledBlockDisplay, compareEncrypted } from '@/lib/utils'
import { GlobalTimeBudgetWebsiteForm } from '@/components/custom/GlobalTimeBudgetWebsiteForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PasswordProtection } from './PasswordProtection';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RestrictedPerDayChart } from './RestrictedPerDayChart';
import { BlockedPerDayChart } from './BlockedPerDayChart';
import { QuotesTable } from '@/components/custom/QuotesTable';
import { QuotesForm } from '@/components/custom/QuotesForm';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';

function Options() {
  const [isAddWebsiteDialogOpen, setIsWebsiteDialogOpen] = useState(false);
  const [isEditGlobalTimeBudgetDialogOpen, setIsEditGlobalTimeBudgetDialogOpen] = useState(false);
  const [isAddGlobalTimeBudgetWebsiteDialogOpen, setIsAddGlobalTimeBudgetWebsiteDialogOpen] = useState(false);

  const [websiteToDelete, setWebsiteToDelete] = useState("")
  const [deleteGlobalDialogOpen, setDeleteGlobalDialogOpen] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [globalWebsiteToDelete, setGlobalWebsiteToDelete] = useState("")
  const [blockedWebsite, setBlockedWebsite] = useState<null | BlockedWebsite>(null); // State for blockedWebsite

  const [blockedWebsitesList, setBlockedWebsitesList] = useState<Record<string, BlockedWebsite>>({});
  const [globalTimeBudget, setGlobalTimeBudget] = useState<GlobalTimeBudget | null>(null);

  const [requirePassword, setRequirePassword] = useState(false);
  const [isPasswordEntryDialogOpen, setIsPasswordEntryDialogOpen] = useState(false);
  const [passwordAction, setPasswordAction] = useState<{ function: (...args: any[]) => void; params: any[]; } | null>(null);
  const [passwordCheck, setPasswordCheck] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [activeTab, setActiveTab] = useState("blockedWebsites");
  const [historicalRestrictedTimePerDay, setHistoricalRestrictedTimePerDay] = useState<Record<string, Record<string, number>>>({});
  const [historicalBlockedPerDay, setHistoricalBlockedPerDay] = useState<Record<string, Record<string, number>>>({});

  const [quotes, setQuotes] = useState<Array<{ author: string; quote: string }> | null>(null);
  const [deleteQuoteDialogOpen, setDeleteQuoteDialogOpen] = useState(false);
  const [addQuoteDialogOpen, setAddQuoteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<{ author: string; quote: string } | null>(null);

  const [whiteListPathsEnabled, setWhiteListPathsEnabled] = useState(false);


  // on load set the active tab to the one that was last open
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section && section == "statistics") {
      setActiveTab("statistics");
      handleStatisticsLoad();
    }
  }, []);

  const [ctaProperty, setCtaProperty] = useState<string>('');
  const [ctaDiscordText, setCtaDiscordText] = useState<string>('');

  const selectCallToAction = () => {
    const randomProperty = Math.random() < 0.5 ? 'discord' : 'github';
    setCtaProperty(randomProperty);

    if (randomProperty === 'discord') {
      const ctaDiscordTexts: string[] = [
        'Have a question? Join the',
        'Need help? Join the',
        'Have a suggestion? Join the',
        'Want to chat? Join the',
        'Like productivity? Join the',
        'Have feedback? Join the',
      ];

      const randomIndex = Math.floor(Math.random() * ctaDiscordTexts.length);
      setCtaDiscordText(ctaDiscordTexts[randomIndex]);
    }
  };

  const refreshQuotes = () => {
    setAddQuoteDialogOpen(false);
    setQuoteToDelete(null);

    browser.storage.local.get(['quotes'], (data) => {
      if (data.quotes) {
        setQuotes(data.quotes);
        browser.storage.sync.set({ quotes: data.quotes });
      }
    });
  }

  const refreshBlockedWebsitesList = () => {
    setIsWebsiteDialogOpen(false);
    setBlockedWebsite(null);

    browser.storage.local.get(['blockedWebsitesList'], (data) => {
      if (data.blockedWebsitesList) {
        setBlockedWebsitesList(data.blockedWebsitesList);
        browser.storage.sync.set({ blockedWebsitesList: data.blockedWebsitesList });
      }
    });

  }

  const refreshGlobalTimeBudget = () => {
    setIsEditGlobalTimeBudgetDialogOpen(false);
    setIsAddGlobalTimeBudgetWebsiteDialogOpen(false);

    browser.storage.local.get(['globalTimeBudget'], (data) => {
      if (data.globalTimeBudget) {
        const globalTimeBudget = GlobalTimeBudget.fromJSON(data.globalTimeBudget);
        setGlobalTimeBudget(globalTimeBudget);
        browser.storage.sync.set({ globalTimeBudget: globalTimeBudget.toJSON() });
      }
    });
  }

  const deleteBlockedWebsite = () => {
    if (!websiteToDelete) return;

    const newBlockedWebsitesList = { ...blockedWebsitesList };
    delete newBlockedWebsitesList[websiteToDelete];

    browser.storage.local.set({ blockedWebsitesList: newBlockedWebsitesList }, () => {
      setBlockedWebsitesList(newBlockedWebsitesList);
      setWebsiteToDelete("");
    });
  }


  const deleteGlobalTimeBudgetWebsite = () => {
    if (!globalWebsiteToDelete || !globalTimeBudget) return;

    globalTimeBudget.websites.delete(globalWebsiteToDelete)

    browser.storage.local.set({ globalTimeBudget: globalTimeBudget.toJSON() }, () => {
      setGlobalTimeBudget(globalTimeBudget);
      setGlobalWebsiteToDelete("");
    });
  }

  const handleDialogClose = () => {
    setIsWebsiteDialogOpen(false);
    setBlockedWebsite(null);
  };

  const handleGlobalTimeBudgetEdit = () => {
    if (requirePassword) {
      setPasswordAction({
        function: setIsEditGlobalTimeBudgetDialogOpen,
        params: [true]
      })
      setIsPasswordEntryDialogOpen(true);
    } else {
      setIsEditGlobalTimeBudgetDialogOpen(true);
    }
  }

  const handleDeleteGlobalBlockedWebsite = (websiteName: string) => {
    setGlobalWebsiteToDelete(websiteName);

    if (requirePassword) {
      setPasswordAction({
        function: setDeleteGlobalDialogOpen,
        params: [true]
      })
      setIsPasswordEntryDialogOpen(true);
    } else {
      setDeleteGlobalDialogOpen(true);
    }
  }

  const handleDeleteBlockedWebsite = (websiteName: string) => {
    setWebsiteToDelete(websiteName);

    if (requirePassword) {
      setPasswordAction({
        function: setDeleteDialogOpen,
        params: [true]
      })
      setIsPasswordEntryDialogOpen(true);
    } else {
      setDeleteDialogOpen(true);
    }
  }

  const handleEditBlockedWebsite = (websiteName: string) => {
    setBlockedWebsite(blockedWebsitesList[websiteName]);

    if (requirePassword) {
      setPasswordAction({
        function: setIsWebsiteDialogOpen,
        params: [true]
      })
      setIsPasswordEntryDialogOpen(true);
    } else {
      setIsWebsiteDialogOpen(true);
    }
  }


  const handlePasswordEntryDialogChange = () => {
    setIsPasswordEntryDialogOpen(false);
    setPasswordCheck("");
    setErrorMsg("");
  }

  const handlePasswordCheck = async () => {
    browser.storage.local.get(['settings'], async (data) => {
      if (data.settings) {
        const isCorrect = await compareEncrypted(passwordCheck, data.settings.password);
        if (isCorrect) {
          setIsPasswordEntryDialogOpen(false);
          setPasswordCheck("");
          setErrorMsg("");
          if (passwordAction) passwordAction.function(...passwordAction.params);
        } else {
          setErrorMsg("Incorrect password");
        }
      }
    });
  }

  const handleWhiteListPathsEnabled = (checked: boolean) => {
    setWhiteListPathsEnabled(checked);
    browser.storage.local.get(['settings'], (data) => {
      const settings = { ...data.settings, whiteListPathsEnabled: checked };
      browser.storage.local.set({ settings: settings });
    });

    if (!checked) {
      browser.storage.local.get(['blockedWebsitesList'], (data) => {
        const newBlockedWebsitesList = { ...data.blockedWebsitesList };
        for (const website in newBlockedWebsitesList) {
          newBlockedWebsitesList[website].allowedPaths = [];
        }
        browser.storage.local.set({ blockedWebsitesList: newBlockedWebsitesList });
      });
    }
  }

  const dayOfTheWeek = (new Date().getDay() + 6) % 7;

  useEffect(() => {
    selectCallToAction();

    // Retrieve related data from storage
    browser.storage.local.get(['blockedWebsitesList', 'globalTimeBudget', 'settings', 'quotes'], (data) => {
      if (data.blockedWebsitesList) {
        setBlockedWebsitesList(data.blockedWebsitesList);
      }

      if (data.globalTimeBudget) {
        const globalTimeBudget = GlobalTimeBudget.fromJSON(data.globalTimeBudget);
        setGlobalTimeBudget(globalTimeBudget);
      }

      if (data.settings.whiteListPathsEnabled !== undefined) {
        setWhiteListPathsEnabled(data.settings.whiteListPathsEnabled);
      }

      if (data.settings.password !== undefined && data.settings.password !== "") {
        setRequirePassword(true);
      }

      if (data.quotes) {
        setQuotes(data.quotes);
      }
    });
  }, []);

  // Refresh the blocked websites list and global time budget when the window gains focus
  useEffect(() => {
    const handleFocus = () => {
      refreshBlockedWebsitesList();
      refreshGlobalTimeBudget();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // load historical data on statistics click
  const handleStatisticsLoad = () => {
    browser.storage.local.get(['dailyStatistics', 'historicalRestrictedTimePerDay', 'historicalBlockedPerDay'], (data) => {
      const dailyStatistics = data.dailyStatistics;
      const historicalRestrictedTimePerDay = data.historicalRestrictedTimePerDay;
      const historicalBlockedPerDay = data.historicalBlockedPerDay;

      historicalRestrictedTimePerDay[dailyStatistics.day] = dailyStatistics.restrictedTimePerDay;
      historicalBlockedPerDay[dailyStatistics.day] = dailyStatistics.blockedPerDay;

      browser.storage.local.set({ historicalRestrictedTimePerDay: historicalRestrictedTimePerDay, historicalBlockedPerDay: historicalBlockedPerDay });

      setHistoricalRestrictedTimePerDay(data.historicalRestrictedTimePerDay);
      setHistoricalBlockedPerDay(data.historicalBlockedPerDay);
    });
  }

  const deleteQuote = () => {
    if (!quoteToDelete || !quotes) return;

    const newQuotes = quotes?.filter(quote => !(quote.author === quoteToDelete.author && quote.quote === quoteToDelete.quote));
    setQuotes(newQuotes);
    browser.storage.local.set({ quotes: newQuotes });
  }


  return (
    <>
      <div className='px-10 flex flex-col min-h-screen max-w-screen-lg mx-auto font-geist'>

        <div className="flex-grow">

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className='mt-8 mb-10 flex items-center'>
              <img src="/images/logo.svg" alt="Logo" className="w-10 h-10 mr-4" />

              <TabsList className='py-5 px-2'>
                <TabsTrigger className='data-[state=active]:shadow-none' value="blockedWebsites"><ShieldBan className='w-5 h-5 mr-1' /> Blocked Websites</TabsTrigger>
                <TabsTrigger className='data-[state=active]:shadow-none' value="globalTimeBudget"><Component className='w-5 h-5 mr-1' /> Group Time Budget</TabsTrigger>
                <TabsTrigger className='data-[state=active]:shadow-none' value="statistics" onClick={handleStatisticsLoad}><ChartNoAxesColumn className='w-5 h-5 mr-1' /> Statistics </TabsTrigger>
                <TabsTrigger className='data-[state=active]:shadow-none' value="settings" ><Settings className='w-5 h-5 mr-1' />  Settings</TabsTrigger>
              </TabsList>
            </div>


            {/* BLOCKED WEBSITES TAB */}
            <TabsContent value="blockedWebsites">
              <div className='flex items-center justify-between mb-5 mt-10'>

                <div className='text-3xl font-bold w-full text-muted-foreground'>
                  Blocked Websites
                </div>
                <div className='w-full text-right '>
                  <Button className="" onClick={() => setIsWebsiteDialogOpen(true)}> <Plus className='h-5 w-5 mr-1' /> Add Website </Button>

                  <Dialog open={isAddWebsiteDialogOpen} onOpenChange={handleDialogClose}>
                    <DialogContent className="bg-card" >
                      <ScrollArea className="max-h-[800px] ">
                        <div className='bg-card m-2 p-4 rounded-md'>
                          <DialogTitle>Block a Distracting Website</DialogTitle>
                          <DialogDescription>
                            <BlockedWebsiteForm blockedWebsiteProp={blockedWebsite} whiteListPathsEnabled={whiteListPathsEnabled} callback={refreshBlockedWebsitesList} />
                          </DialogDescription>
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </div>

              </div>

              <div className="rounded-xl bg-muted/50 px-5 py-4" >
                <BlockedWebsitesTable blockedWebsites={blockedWebsitesList} deleteBlockedWebsite={handleDeleteBlockedWebsite} editBlockedWebsite={handleEditBlockedWebsite} />
              </div>


              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="sm:max-w-[425px] p-6">
                  <DialogHeader>
                    <DialogTitle>
                      Delete Blocked Website
                    </DialogTitle>
                    <DialogDescription className='pt-2'>
                      Are you sure you want to delete <span className='font-bold'>{websiteToDelete}</span>?
                    </DialogDescription>
                  </DialogHeader>

                  <DialogFooter className='pt-2'>
                    <Button type="submit" variant={"destructive"} onClick={() => {
                      deleteBlockedWebsite();
                      setDeleteDialogOpen(false);
                    }}>Delete</Button>
                    <Button type="submit" onClick={() => setDeleteDialogOpen(false)}>Close</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* BLOCKED WEBSITES TAB */}
            <TabsContent value="globalTimeBudget">
              <div className='mt-10 mb-5'>

                <div className='flex items-center justify-between text-3xl font-bold w-full text-muted-foreground'>
                  <div className='flex items-center'>
                    Group Time Budget
                    <TooltipProvider>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild >
                          <button tabIndex={-1} className="flex items-center justify-center ml-2 rounded-full" >
                            <Info className="ml-2 mt-0.5 w-5 h-5 text-chart-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-primary text-foreground p-2 rounded " >
                          Group time budget allows you to manage the time spent on a group of websites at once. <br />
                          Whenever you visit each website time will be substracted from the group allowed time. <br />
                          When the group timer hits 0, all websites from the group will be inaccessible.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                  </div>

                  <div className='flex items-center'>
                    <Button onClick={() => handleGlobalTimeBudgetEdit()}> <Pencil className='h-4 w-4 mr-2' /> Edit </Button>
                    <Button className="ml-4" onClick={() => setIsAddGlobalTimeBudgetWebsiteDialogOpen(true)}> <Plus className='h-5 w-5 mr-1' /> Add Website </Button>
                  </div>

                </div>

                <div className='mt-8 flex items-stretch w-full'>
                  <div className='flex items-stretch w-full'>
                    <Card >
                      <CardHeader className="p-5">
                        <CardTitle>Allowed Per Day</CardTitle>
                      </CardHeader>
                      <CardContent className={globalTimeBudget?.variableSchedule ? "p-5 pt-0 flex flex-wrap w-[280px]" : "p-5 pt-0 flex flex-wrap"}>
                        {globalTimeBudget?.variableSchedule ? (
                          Array.from({ length: 7 }, (_, i) => {
                            const dayIndex = i; // Adjust the index to start from 1
                            return (
                              <div key={dayIndex} className="flex flex-col items-center mx-1 mt-1">
                                <div
                                  className={
                                    dayIndex === dayOfTheWeek
                                      ? "w-16 h-16 m-1 flex flex-col items-center justify-center rounded-full cursor-pointer bg-primary text-muted-foreground select-none"
                                      : "w-16 h-16 m-1 flex flex-col items-center justify-center rounded-full cursor-pointer bg-background text-muted-foreground select-none"
                                  }
                                >
                                  {['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'][i]}
                                  <div className="text-[0.8rem]">
                                    {timeDisplayFormat(globalTimeBudget.timeAllowed[dayIndex], true)}
                                  </div>
                                </div>

                              </div>
                            );
                          })
                        ) : (
                          <div className='text-2xl font-medium text-muted-foreground'> {globalTimeBudget ? timeDisplayFormat(globalTimeBudget?.timeAllowed[0]) : "00:00"} </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="ml-5 flex-1">
                      <CardHeader className="p-5">
                        <CardTitle>Time Left Today</CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 pt-0">
                        <div className='text-2xl font-medium text-muted-foreground'> {globalTimeBudget ? timeDisplayFormat(globalTimeBudget?.timeAllowed[dayOfTheWeek] - globalTimeBudget?.totalTime) : "00:00"} </div>
                      </CardContent>
                    </Card>

                    <Card className="ml-5 flex-1">
                      <CardHeader className="p-5">
                        <CardTitle>Redirects to</CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 pt-0">
                        <div className='text-2xl font-medium text-muted-foreground'> {globalTimeBudget ? (globalTimeBudget.redirectUrl == "" ? "Inspiration" : globalTimeBudget.redirectUrl) : "Inspiration"} </div>
                      </CardContent>
                    </Card>

                    <Card className="ml-5 flex-1">
                      <CardHeader className="p-5">
                        <CardTitle>Block in Incognito</CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 pt-0">
                        <div className='text-2xl font-medium text-muted-foreground'> {globalTimeBudget ? (globalTimeBudget.blockIncognito ? "Yes" : "No") : "No"} </div>
                      </CardContent>
                    </Card>

                    <Card className="ml-5">
                      <CardHeader className="p-5">
                        <CardTitle>Scheduled Block</CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 pt-0 flex flex-wrap">
                        <div className='text-lg font-medium text-muted-foreground'>
                          {globalTimeBudget?.scheduledBlockRanges.length === 0 && "None"}
                          {globalTimeBudget?.scheduledBlockRanges.map((range, index) => (
                            <div key={index} className={index !== globalTimeBudget?.scheduledBlockRanges.length - 1 ? "mb-5" : ""}>
                              {scheduledBlockDisplay(range)}
                              <div className="flex flex-wrap items-center text-sm font-normal">
                                {range.days.every(day => day) ? (
                                  <div className="text-muted-foreground">Every Day</div>
                                ) : (
                                  Array.from({ length: 7 }, (_, i) => (
                                    <div key={i} className="flex flex-col items-center">
                                      <div
                                        className={
                                          range.days[i]
                                            ? "w-7 h-7 mr-1 mt-1 flex flex-col items-center justify-center rounded-full cursor-pointer bg-primary text-muted-foreground select-none"
                                            : "w-7 h-7 mr-1 mt-1 flex flex-col items-center justify-center rounded-full cursor-pointer bg-background text-muted-foreground select-none"
                                        }
                                      >
                                        {['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'][i]}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Dialog open={isEditGlobalTimeBudgetDialogOpen} onOpenChange={() => { setIsEditGlobalTimeBudgetDialogOpen(false) }}>
                  <DialogContent className="bg-card" >
                    <ScrollArea className="max-h-[800px] ">
                      <div className='bg-card m-2 p-4 rounded-md'>
                        <DialogTitle>Setup Group Time Budget</DialogTitle>
                        <DialogDescription>
                          <GlobalTimeBudgetForm globalTimeBudgetProp={globalTimeBudget} callback={refreshGlobalTimeBudget} />
                        </DialogDescription>
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>

                <Dialog open={isAddGlobalTimeBudgetWebsiteDialogOpen} onOpenChange={() => { setIsAddGlobalTimeBudgetWebsiteDialogOpen(false) }}>
                  <DialogContent className="bg-card" >
                    <ScrollArea className="max-h-[800px] ">
                      <div className='bg-card m-2 p-4 rounded-md'>
                        <DialogTitle>Add Group Time Budget Website</DialogTitle>
                        <DialogDescription>
                          <GlobalTimeBudgetWebsiteForm callback={refreshGlobalTimeBudget} />
                        </DialogDescription>
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="rounded-xl bg-muted/50 px-5 py-4" >
                <GlobalTimeBudgetTable globalTimeBudgetWebsites={globalTimeBudget ? globalTimeBudget?.websites : null} deleteBlockedWebsite={(websiteName: string) => handleDeleteGlobalBlockedWebsite(websiteName)} />
              </div>

              <Dialog open={deleteGlobalDialogOpen} onOpenChange={setDeleteGlobalDialogOpen}>
                <DialogContent className="sm:max-w-[425px] p-6">
                  <DialogHeader>
                    <DialogTitle>
                      Delete Group Time Budget Website
                    </DialogTitle>
                    <DialogDescription className='pt-2'>
                      Are you sure you want to delete <span className='font-bold'>{globalWebsiteToDelete}</span>?
                    </DialogDescription>
                  </DialogHeader>

                  <DialogFooter className='pt-2'>
                    <Button type="submit" variant={"destructive"} onClick={() => {
                      deleteGlobalTimeBudgetWebsite();
                      setDeleteGlobalDialogOpen(false);
                    }}>Delete</Button>
                    <Button type="submit" onClick={() => setDeleteGlobalDialogOpen(false)}>Close</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* STATISTICS TAB */}
            <TabsContent value="statistics">
              <div className='mt-10 mb-5'>
                <div className='text-3xl font-bold w-full text-muted-foreground'>
                  Statistics
                </div>
                <div className='mt-8 bg-muted/50 p-5 rounded-xl'>
                  <div className='mb-5'>
                    <RestrictedPerDayChart historicalRestrictedTimePerDay={historicalRestrictedTimePerDay} />
                  </div>
                  <div>
                    <BlockedPerDayChart historicalBlockedPerDay={historicalBlockedPerDay} />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* SETTINGS TAB */}
            <TabsContent value="settings">
              <div className='mt-10 mb-5'>
                <div className='text-3xl font-bold w-full text-muted-foreground'>
                  Settings
                </div>

                <div className='mt-8 bg-muted/50 p-5 rounded-xl'>
                  <PasswordProtection
                    requirePassword={requirePassword}
                    setRequirePassword={setRequirePassword}
                  />
                </div>

                <div className='mt-4 bg-muted/50 p-5 rounded-xl'>
                  <QuotesTable quotes={quotes} addQuote={() => { setAddQuoteDialogOpen(true) }} deleteQuote={({ author, quote }) => { setQuoteToDelete({ author, quote }); setDeleteQuoteDialogOpen(true) }} />
                </div>

                <Accordion type="single" collapsible className="w-full bg-muted/50 p-4 mt-4 rounded-2xl">
                  <AccordionItem value="item-1">
                    <AccordionTrigger className='text-base'>Advanced Settings</AccordionTrigger>
                    <AccordionContent>

                      <div className="flex items-center justify-between max-w-[350px] mt-4">
                        <div className="flex items-center">
                          <Label className='text-base' htmlFor="whiteListPathsEnabled">Enable Whitelisting of URL Paths</Label>
                          <TooltipProvider>
                            <Tooltip delayDuration={0}>
                              <TooltipTrigger asChild>
                                <button className="flex items-center justify-center ml-2 rounded-full">
                                  <Info className="w-4 h-4 text-chart-5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-primary text-foreground p-2 rounded">
                                When blocking a website (e.g. youtube.com) enable the option to allow access to specific URL paths(e.g. youtube.com/watch?v=12345678).
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Switch
                          id="whiteListPathsEnabled"
                          className='data-[state=unchecked]:bg-background'
                          checked={whiteListPathsEnabled}
                          onCheckedChange={handleWhiteListPathsEnabled}
                        />
                      </div>

                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </TabsContent>

            <Dialog open={addQuoteDialogOpen} onOpenChange={() => { setAddQuoteDialogOpen(false) }}>
              <DialogContent className="bg-card" >
                <ScrollArea className="max-h-[800px] ">
                  <div className='bg-card m-2 p-4 rounded-md'>
                    <DialogTitle>Add New Quote</DialogTitle>
                    <DialogDescription>
                      <QuotesForm callback={refreshQuotes} />
                    </DialogDescription>
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>

            <Dialog open={deleteQuoteDialogOpen} onOpenChange={setDeleteQuoteDialogOpen}>
              <DialogContent className="sm:max-w-[425px] p-6">
                <DialogHeader>
                  <DialogTitle>
                    Delete Quote
                  </DialogTitle>
                  <DialogDescription className='pt-2'>
                    Are you sure you want to delete this quote <span className='font-bold'>{quoteToDelete?.quote}  - {quoteToDelete?.author}</span>?
                  </DialogDescription>
                </DialogHeader>

                <DialogFooter className='pt-2'>
                  <Button type="submit" variant={"destructive"} onClick={() => {
                    deleteQuote();
                    setDeleteQuoteDialogOpen(false);
                  }}>Delete</Button>
                  <Button type="submit" onClick={() => setDeleteQuoteDialogOpen(false)}>Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Tabs>
        </div>

        <Dialog open={isPasswordEntryDialogOpen} onOpenChange={handlePasswordEntryDialogChange} >
          <DialogContent className="bg-card" >
            <div className='bg-card m-2 p-4 rounded-md'>
              <DialogTitle>Password Protection</DialogTitle>
              <DialogDescription>
                <div className="w-[99%] mx-auto">
                  <div className="mt-5">
                    <div className="mt-5 flex items-center" >
                      <Label htmlFor="password">
                        Password
                      </Label>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild >
                            <button tabIndex={-1} className="flex items-center justify-center ml-2 rounded-full" >
                              <Info className="w-4 h-4 text-chart-5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-primary text-foreground p-2 rounded " >
                            Enter the password to edit settings.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <>
                      <Input
                        className='mt-2'
                        type='password'
                        id="passwordCheck"
                        value={passwordCheck}
                        placeholder="Enter password"
                        onChange={(e) => setPasswordCheck(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handlePasswordCheck();
                          }
                        }}
                      />
                      <div className='w-full text-right mb-2'>
                        <Button className="mt-5" onClick={() => handlePasswordCheck()}> Disable </Button>
                      </div>
                    </>

                    {errorMsg && <p className="text-red-500 text-sm mt-2"> {errorMsg} </p>}
                  </div>
                </div >
              </DialogDescription>
            </div>
          </DialogContent>
        </Dialog>

        <footer className="bg-muted rounded-t-lg py-5 px-8 mt-10">
          <div className="container mx-auto flex justify-between items-center text-xs">
            <div className="flex items-center text-muted-foreground font-semibold"> <img src="/images/gm_logo.svg" alt="Grounded Momentum Logo" className="w-6 h-6 mr-2" /> Grounded Momentum <Dot className='w-2 h-2 mx-1' /> 2025 </div>
            {ctaProperty === 'discord' ? (
              <div className="flex items-center text-muted-foreground font-semibold">
                {ctaDiscordText}
                <div className='flex items-center'>
                  <Button className="ml-3 rounded-lg" onClick={() => { window.open("https://discord.gg/SvTsqKwsgN", "_blank") }}>  <img height="20" width="20" className="mr-1 color-white" src="https://cdn.simpleicons.org/discord/5c4523" /> Discord </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center text-muted-foreground font-semibold">
                Want a Pomodoro Focus Timer? Try
                <div className='flex items-center'>
                  <Button
                    className="ml-3 rounded-lg bg-background hover:bg-[#ff1d25]/20 text-[#ff1d25]"
                    onClick={() => {
                      let url = "https://chromewebstore.google.com/detail/cadence-pomodoro-focus-ti/mjpanfloecbdhkpilhgkglonabikjadf";
                      if (import.meta.env.BROWSER === "firefox") {
                        url = "https://addons.mozilla.org/en-US/firefox/addon/cadence-pomodoro-focus-timers/";
                      } else if (import.meta.env.BROWSER === "edge") {
                        url = "https://microsoftedge.microsoft.com/addons/detail/cadence-pomodoro-focus-/lkgpghlmfjbmfjckgebegoclmklkhdml";
                      }
                      window.open(url, "_blank");
                    }}
                  >
                    <img src="/images/logo-cadence.svg" alt="Logo" className="w-5 h-5 mr-2" /> Cadence
                  </Button>
                </div>
              </div>
            )}
          </div>
        </footer>
      </div >
    </>
  )
}

export default Options;