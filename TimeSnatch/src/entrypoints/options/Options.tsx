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
import { Plus, Pencil, Info, ShieldBan, Component, Dot, Settings, ChartNoAxesColumn, Sparkles, CloudOff, CheckCircle2, RefreshCw } from 'lucide-react'
import { loadUserFromStorage } from "@/lib/auth";
import {
  getSyncStatus,
  subscribeSyncStatus,
  type SyncStatus,
  syncDeleteWebsite,
  syncAll,
  syncAddGroupBudget,
  syncUpdateGroupBudget,
  syncDeleteGroupBudget,
  syncDeleteQuote,
  syncUpdateSettings
} from "@/lib/sync";
import { User } from "@/models/User.ts";
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
import { StatsOverview } from './StatsOverview';
import { QuotesTable } from '@/components/custom/QuotesTable';
import { QuotesForm } from '@/components/custom/QuotesForm';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { GMPlus } from './GMPlus';

function Options() {
  const [isAddWebsiteDialogOpen, setIsWebsiteDialogOpen] = useState(false);
  const [isEditGlobalTimeBudgetDialogOpen, setIsEditGlobalTimeBudgetDialogOpen] = useState(false);
  const [isAddGlobalTimeBudgetWebsiteDialogOpen, setIsAddGlobalTimeBudgetWebsiteDialogOpen] = useState(false);

  const [websiteToDelete, setWebsiteToDelete] = useState("")
  const [deleteGlobalDialogOpen, setDeleteGlobalDialogOpen] = useState(false);
  const [deleteBudgetDialogOpen, setDeleteBudgetDialogOpen] = useState(false);
  const [budgetToDeleteIndex, setBudgetToDeleteIndex] = useState<number>(-1);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [globalWebsiteToDelete, setGlobalWebsiteToDelete] = useState("")
  const [blockedWebsite, setBlockedWebsite] = useState<null | BlockedWebsite>(null); // State for blockedWebsite

  const [blockedWebsitesList, setBlockedWebsitesList] = useState<Record<string, BlockedWebsite>>({});
  const [groupTimeBudgets, setGroupTimeBudgets] = useState<GlobalTimeBudget[]>([]);
  const [selectedBudgetIndex, setSelectedBudgetIndex] = useState<number>(0);

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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [user, setUser] = useState<User>(new User());

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      const loadedUser = await loadUserFromStorage();
      if (loadedUser) {
        setUser(loadedUser);
      }
    };
    loadUser();

    // Listen for user changes in storage (e.g., when user logs in)
    const handleStorageChange = (changes: any, areaName: string) => {
      if (areaName === 'local' && changes.user) {
        const newUser = changes.user.newValue;
        if (newUser) {
          setUser(User.fromJSON(newUser));
        } else {
          setUser(new User());
        }
      }

      // Refresh data when sync updates storage
      if (areaName === 'local') {
        if (changes.blockedWebsitesList) {
          setBlockedWebsitesList(changes.blockedWebsitesList.newValue || {});
        }
        if (changes.groupTimeBudgets) {
          const budgets = (changes.groupTimeBudgets.newValue || []).map((b: any) =>
            GlobalTimeBudget.fromJSON(b)
          );
          setGroupTimeBudgets(budgets);
        }
        if (changes.quotes) {
          setQuotes(changes.quotes.newValue || []);
        }
        if (changes.settings) {
          const newSettings = changes.settings.newValue;
          if (newSettings) {
            setRequirePassword(!!newSettings.password);
            setWhiteListPathsEnabled(newSettings.whiteListPathsEnabled || false);
          }
        }
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    return () => browser.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Subscribe to sync status changes and sync all data when settings page opens
  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((status) => {
      setSyncStatus(status);
    });

    if (user.isPro && user.authToken) {
      syncAll(user.authToken);
    }

    return unsubscribe;
  }, [user.isPro, user.authToken]);


  // on load set the active tab to the one that was last open
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section) {
      if (section === "statistics") {
        setActiveTab("statistics");
        handleStatisticsLoad();
      } else if (section === "gmplus") {
        setActiveTab("gmplus");
      } else {
        setActiveTab(section);
      }
    }
  }, []);

  const [ctaDiscordText, setCtaDiscordText] = useState<string>('');

  const selectCallToAction = () => {
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

    browser.storage.local.get(['groupTimeBudgets'], (data) => {
      if (data.groupTimeBudgets && Array.isArray(data.groupTimeBudgets)) {
        const budgets = data.groupTimeBudgets.map((b: any) => GlobalTimeBudget.fromJSON(b));
        setGroupTimeBudgets(budgets);
        browser.storage.sync.set({ groupTimeBudgets: data.groupTimeBudgets });
      }
    });
  }

  const deleteBlockedWebsite = () => {
    if (!websiteToDelete) return;

    const newBlockedWebsitesList = { ...blockedWebsitesList };
    delete newBlockedWebsitesList[websiteToDelete];

    browser.storage.local.set({ blockedWebsitesList: newBlockedWebsitesList }, () => {
      syncDeleteWebsite(websiteToDelete);

      setBlockedWebsitesList(newBlockedWebsitesList);
      setWebsiteToDelete("");
    });
  }

  const handleForceSync = async () => {
    if (!user.isPro || !user.authToken) {
      return;
    }

    await syncAll(user.authToken);
  };


  const deleteGlobalTimeBudgetWebsite = () => {
    if (!globalWebsiteToDelete || selectedBudgetIndex < 0 || selectedBudgetIndex >= groupTimeBudgets.length) return;

    const updatedBudgets = [...groupTimeBudgets];
    updatedBudgets[selectedBudgetIndex].websites.delete(globalWebsiteToDelete);

    browser.storage.local.set({ groupTimeBudgets: updatedBudgets.map(b => b.toJSON()) }, () => {
      // Sync to backend (fire-and-forget) - update the entire budget
      syncUpdateGroupBudget(selectedBudgetIndex, updatedBudgets[selectedBudgetIndex].toJSON());

      setGroupTimeBudgets(updatedBudgets);
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

  const openBlockedWebsiteEditDialog = (websiteName: string) => {
    setBlockedWebsite(blockedWebsitesList[websiteName]);
    setIsWebsiteDialogOpen(true);
  }

  const handleAddBlockedWebsite = () => {
    setBlockedWebsite(null);
    setIsWebsiteDialogOpen(true);
  }

  const handleEditBlockedWebsite = (websiteName: string) => {
    if (requirePassword) {
      setPasswordAction({
        function: openBlockedWebsiteEditDialog,
        params: [websiteName]
      })
      setIsPasswordEntryDialogOpen(true);
    } else {
      openBlockedWebsiteEditDialog(websiteName);
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
      browser.storage.local.set({ settings: settings }, () => {
        // Sync to backend (fire-and-forget)
        syncUpdateSettings({ whiteListPathsEnabled: checked });
      });
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

  const addNewGroupBudget = () => {
    const newBudget = new GlobalTimeBudget(
      new Set(),
      { 0: 300, 1: 300, 2: 300, 3: 300, 4: 300, 5: 300, 6: 300 },
      false,
      false,
      "",
      new Date().toLocaleDateString('en-CA').slice(0, 10),
      []
    );

    const updatedBudgets = [...groupTimeBudgets, newBudget];
    browser.storage.local.set({ groupTimeBudgets: updatedBudgets.map(b => b.toJSON()) }, () => {
      // Sync to backend (fire-and-forget)
      syncAddGroupBudget(newBudget.toJSON());

      setGroupTimeBudgets(updatedBudgets);
      setSelectedBudgetIndex(updatedBudgets.length - 1);
    });
  }

  const deleteGroupBudget = (index: number) => {
    // Always keep at least one budget
    if (groupTimeBudgets.length <= 1) return;

    const updatedBudgets = groupTimeBudgets.filter((_, i) => i !== index);
    browser.storage.local.set({ groupTimeBudgets: updatedBudgets.map(b => b.toJSON()) }, () => {
      // Sync to backend (fire-and-forget)
      syncDeleteGroupBudget(index);

      setGroupTimeBudgets(updatedBudgets);
      // Adjust selected index if necessary
      if (selectedBudgetIndex >= updatedBudgets.length) {
        setSelectedBudgetIndex(updatedBudgets.length - 1);
      } else if (selectedBudgetIndex === index && selectedBudgetIndex > 0) {
        setSelectedBudgetIndex(selectedBudgetIndex - 1);
      }
    });
  }

  const handleDeleteGroupBudget = (index: number) => {
    if (groupTimeBudgets.length <= 1) return;

    setBudgetToDeleteIndex(index);

    if (requirePassword) {
      setPasswordAction({
        function: setDeleteBudgetDialogOpen,
        params: [true]
      })
      setIsPasswordEntryDialogOpen(true);
    } else {
      setDeleteBudgetDialogOpen(true);
    }
  }

  const dayOfTheWeek = (new Date().getDay() + 6) % 7;

  useEffect(() => {
    selectCallToAction();

    // Retrieve related data from storage
    browser.storage.local.get(['blockedWebsitesList', 'groupTimeBudgets', 'settings', 'quotes'], (data) => {
      if (data.blockedWebsitesList) {
        setBlockedWebsitesList(data.blockedWebsitesList);
      }

      if (data.groupTimeBudgets && Array.isArray(data.groupTimeBudgets)) {
        const budgets = data.groupTimeBudgets.map((b: any) => GlobalTimeBudget.fromJSON(b));
        setGroupTimeBudgets(budgets);
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

    const quoteIndex = quotes.findIndex(quote => quote.author === quoteToDelete.author && quote.quote === quoteToDelete.quote);
    const newQuotes = quotes?.filter(quote => !(quote.author === quoteToDelete.author && quote.quote === quoteToDelete.quote));

    setQuotes(newQuotes);
    browser.storage.local.set({ quotes: newQuotes }, () => {
      // Sync to backend (fire-and-forget)
      if (quoteIndex !== -1) {
        syncDeleteQuote(quoteIndex);
      }
    });
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
                <TabsTrigger className='data-[state=active]:shadow-none ml-1 bg-gradient-to-r from-chart-1 to-chart-3 text-white data-[state=active]:text-white transition-all duration-100 hover:scale-105' value="gmplus" ><Sparkles className='w-5 h-5 mr-1' />  GM Plus</TabsTrigger>
              </TabsList>
              {/* Sync status indicator - only show for Pro users */}
              {user.isPro && (
                <div className="flex items-center space-x-3 ml-4">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    {syncStatus === "idle" && (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Synced</span>
                      </>
                    )}
                    {syncStatus === "syncing" && (
                      <>
                        <RefreshCw className="w-4 h-4 animate-pulse" />
                        <span>Syncing...</span>
                      </>
                    )}
                    {syncStatus === "success" && (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Synced</span>
                      </>
                    )}
                    {syncStatus === "error" && (
                      <>
                        <CloudOff className="w-4 h-4 text-destructive" />
                        <span className="text-destructive">Sync failed</span>
                      </>
                    )}
                  </div>
                  <Button
                    onClick={handleForceSync}
                    disabled={syncStatus === "syncing"}
                    size="sm"
                    variant="outline"
                    className="h-8 hover:bg-muted/50 transition-colors shadow-none border-muted-foreground/50 text-muted-foreground"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Sync Now
                  </Button>
                </div>
              )}
            </div>


            {/* BLOCKED WEBSITES TAB */}
            <TabsContent value="blockedWebsites">
              <div className='flex items-center justify-between mb-5 mt-10'>

                <div className='text-3xl font-bold w-full text-muted-foreground'>
                  Blocked Websites
                </div>
                <div className='w-full text-right '>
                  <Button className="" onClick={handleAddBlockedWebsite}> <Plus className='h-5 w-5 mr-1' /> Add Website </Button>

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

            {/* GROUP TIME BUDGETS TAB */}
            <TabsContent value="globalTimeBudget">
              <div className='mt-10 mb-5'>

                <div className='flex items-center justify-between text-3xl font-bold w-full text-muted-foreground mb-8'>
                  <div className='flex items-center'>
                    Group Time Budgets
                    <TooltipProvider>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild >
                          <button tabIndex={-1} className="flex items-center justify-center ml-2 rounded-full" >
                            <Info className="ml-2 mt-0.5 w-5 h-5 text-chart-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-primary text-foreground p-2 rounded " >
                          Group time budgets allow you to manage the time spent on groups of websites. <br />
                          Whenever you visit a website, time will be subtracted from all group budgets containing it. <br />
                          When a group timer hits 0, all websites from that group will be inaccessible.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                {/* Display all budgets */}
                {groupTimeBudgets.map((budget, budgetIndex) => {
                  const isSelected = selectedBudgetIndex === budgetIndex;
                  return (
                    <div key={budgetIndex} className={`mb-6 p-4 rounded-xl ${isSelected ? 'bg-muted/80 border-2 border-primary' : 'bg-muted/50'} cursor-pointer transition-all`}
                      onClick={() => setSelectedBudgetIndex(budgetIndex)}>

                      <div className='flex items-center justify-between mb-4'>
                        <div className='text-xl font-bold text-muted-foreground'>
                          Budget {budgetIndex + 1}
                          {budget.websites.size > 0 && (
                            <span className='ml-2 text-sm font-normal'>({budget.websites.size} {budget.websites.size === 1 ? 'website' : 'websites'})</span>
                          )}
                        </div>
                        <div className='flex items-center gap-2'>
                          <Button size="sm" onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBudgetIndex(budgetIndex);
                            handleGlobalTimeBudgetEdit();
                          }}>
                            <Pencil className='h-4 w-4 mr-2' /> Edit
                          </Button>
                          <Button size="sm" onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBudgetIndex(budgetIndex);
                            setIsAddGlobalTimeBudgetWebsiteDialogOpen(true);
                          }}>
                            <Plus className='h-5 w-5 mr-1' /> Add Website
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={groupTimeBudgets.length <= 1}
                            onClick={(e) => { e.stopPropagation(); handleDeleteGroupBudget(budgetIndex); }}
                          >
                            Delete Budget
                          </Button>
                        </div>
                      </div>

                      <div className='flex items-stretch w-full gap-4'>
                        <Card className="flex-1">
                          <CardHeader className="p-5">
                            <CardTitle>Allowed Per Day</CardTitle>
                          </CardHeader>
                          <CardContent className={budget.variableSchedule ? "p-5 pt-0 flex flex-wrap w-[280px]" : "p-5 pt-0 flex flex-wrap"}>
                            {budget.variableSchedule ? (
                              Array.from({ length: 7 }, (_, i) => {
                                const dayIndex = i;
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
                                        {timeDisplayFormat(budget.timeAllowed[dayIndex], true)}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className='text-2xl font-medium text-muted-foreground'> {timeDisplayFormat(budget.timeAllowed[0])} </div>
                            )}
                          </CardContent>
                        </Card>

                        <Card className="flex-1">
                          <CardHeader className="p-5">
                            <CardTitle>Time Left Today</CardTitle>
                          </CardHeader>
                          <CardContent className="p-5 pt-0">
                            <div className='text-2xl font-medium text-muted-foreground'> {timeDisplayFormat(budget.timeAllowed[dayOfTheWeek] - budget.totalTime)} </div>
                          </CardContent>
                        </Card>

                        <Card className="flex-1">
                          <CardHeader className="p-5">
                            <CardTitle>Redirects to</CardTitle>
                          </CardHeader>
                          <CardContent className="p-5 pt-0">
                            <div className='text-2xl font-medium text-muted-foreground'> {budget.redirectUrl == "" ? "Inspiration" : budget.redirectUrl} </div>
                          </CardContent>
                        </Card>

                        <Card className="flex-1">
                          <CardHeader className="p-5">
                            <CardTitle>Block in Incognito</CardTitle>
                          </CardHeader>
                          <CardContent className="p-5 pt-0">
                            <div className='text-2xl font-medium text-muted-foreground'> {budget.blockIncognito ? "Yes" : "No"} </div>
                          </CardContent>
                        </Card>

                        <Card className="flex-1">
                          <CardHeader className="p-5">
                            <CardTitle>Scheduled Block</CardTitle>
                          </CardHeader>
                          <CardContent className="p-5 pt-0 flex flex-wrap">
                            <div className='text-lg font-medium text-muted-foreground'>
                              {budget.scheduledBlockRanges.length === 0 && "None"}
                              {budget.scheduledBlockRanges.map((range, index) => (
                                <div key={index} className={index !== budget.scheduledBlockRanges.length - 1 ? "mb-5" : ""}>
                                  {scheduledBlockDisplay(range)}
                                  <div className="flex flex-wrap items-center text-sm font-normal">
                                    {range.days.every((day: boolean) => day) ? (
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

                      {/* Websites Table for this budget */}
                      {budget.websites.size > 0 && (
                        <div className="mt-4 rounded-xl bg-background/50 px-5 py-4">
                          <GlobalTimeBudgetTable
                            globalTimeBudgetWebsites={budget.websites}
                            deleteBlockedWebsite={(websiteName: string) => handleDeleteGlobalBlockedWebsite(websiteName)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add New Budget Button */}
                <div className="flex justify-center mt-8">
                  <Button
                    onClick={addNewGroupBudget}
                    className="rounded-full w-14 h-14 p-0"
                    size="lg"
                  >
                    <Plus className='h-8 w-8' />
                  </Button>
                </div>

                <Dialog open={isEditGlobalTimeBudgetDialogOpen} onOpenChange={() => { setIsEditGlobalTimeBudgetDialogOpen(false) }}>
                  <DialogContent className="bg-card" >
                    <ScrollArea className="max-h-[800px] ">
                      <div className='bg-card m-2 p-4 rounded-md'>
                        <DialogTitle>Setup Group Time Budget</DialogTitle>
                        <DialogDescription>
                          <GlobalTimeBudgetForm
                            globalTimeBudgetProp={groupTimeBudgets[selectedBudgetIndex]}
                            callback={refreshGlobalTimeBudget}
                            budgetIndex={selectedBudgetIndex}
                          />
                        </DialogDescription>
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>

                <Dialog open={isAddGlobalTimeBudgetWebsiteDialogOpen} onOpenChange={() => { setIsAddGlobalTimeBudgetWebsiteDialogOpen(false) }}>
                  <DialogContent className="bg-card" >
                    <ScrollArea className="max-h-[800px] ">
                      <div className='bg-card m-2 p-4 rounded-md'>
                        <DialogTitle>Add Website to Budget {selectedBudgetIndex + 1}</DialogTitle>
                        <DialogDescription>
                          <GlobalTimeBudgetWebsiteForm
                            callback={refreshGlobalTimeBudget}
                            budgetIndex={selectedBudgetIndex}
                          />
                        </DialogDescription>
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>

              <Dialog open={deleteGlobalDialogOpen} onOpenChange={setDeleteGlobalDialogOpen}>
                <DialogContent className="sm:max-w-[425px] p-6">
                  <DialogHeader>
                    <DialogTitle>
                      Delete Group Time Budget Website
                    </DialogTitle>
                    <DialogDescription className='pt-2'>
                      Are you sure you want to delete <span className='font-bold'>{globalWebsiteToDelete}</span> from Budget {selectedBudgetIndex + 1}?
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

              <Dialog open={deleteBudgetDialogOpen} onOpenChange={setDeleteBudgetDialogOpen}>
                <DialogContent className="sm:max-w-[425px] p-6">
                  <DialogHeader>
                    <DialogTitle>
                      Delete Group Time Budget
                    </DialogTitle>
                    <DialogDescription className='pt-2'>
                      Are you sure you want to delete Budget {budgetToDeleteIndex + 1}? This will remove all {groupTimeBudgets[budgetToDeleteIndex]?.websites.size || 0} websites from this budget.
                    </DialogDescription>
                  </DialogHeader>

                  <DialogFooter className='pt-2'>
                    <Button type="submit" variant={"destructive"} onClick={() => {
                      deleteGroupBudget(budgetToDeleteIndex);
                      setDeleteBudgetDialogOpen(false);
                    }}>Delete Budget</Button>
                    <Button type="submit" onClick={() => setDeleteBudgetDialogOpen(false)}>Close</Button>
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
                <StatsOverview
                  historicalRestrictedTimePerDay={historicalRestrictedTimePerDay}
                  historicalBlockedPerDay={historicalBlockedPerDay}
                />
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

            {/* GM PLUS TAB */}
            <TabsContent value="gmplus">
              <GMPlus />
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
            <a href="https://groundedmomentum.com/" target="_blank" rel="noopener noreferrer" className="flex items-center text-muted-foreground font-semibold transition-colors">
              <img src="/images/gm_logo.svg" alt="Grounded Momentum Logo" className="w-6 h-6 mr-2" /> Grounded Momentum <Dot className='w-2 h-2 mx-1' /> 2026
            </a>
            <div className="flex items-center text-muted-foreground font-semibold">
              {ctaDiscordText}
              <div className='flex items-center'>
                <Button className="ml-3 rounded-lg" onClick={() => { window.open("https://discord.gg/SvTsqKwsgN", "_blank") }}>  <img height="20" width="20" className="mr-2 color-white" src="https://cdn.simpleicons.org/discord/5c4523" /> Discord </Button>
              </div>
            </div>
          </div>
        </footer>
      </div >
    </>
  )
}

export default Options;