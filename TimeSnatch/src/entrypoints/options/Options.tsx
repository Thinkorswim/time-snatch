import { useState, useEffect } from 'react'
import './style.css';
import '~/assets/global.css';
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
  syncAll,
  syncBlockedWebsitesBg,
  syncGroupBudgetsBg,
  syncQuotesBg,
  syncSettingsBg,
  type BlockedWebsiteRecord,
  type GroupBudgetRecord,
  type QuoteRecord,
  type CounterRecord,
} from "@/lib/sync";
import { totalForTarget, todayDateStr } from "@/lib/counters";
import { User } from "@/models/User.ts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { t, useLocale, useEnsureLocaleLoaded, weekdaysShort, SUPPORTED_LOCALES, setActiveLocale, getActiveLocale, type LocaleCode } from '@/lib/i18n';

function Options() {
  useLocale();
  useEnsureLocaleLoaded();
  const dayShort = weekdaysShort();
  const [isAddWebsiteDialogOpen, setIsWebsiteDialogOpen] = useState(false);
  const [isEditGlobalTimeBudgetDialogOpen, setIsEditGlobalTimeBudgetDialogOpen] = useState(false);
  const [isAddGlobalTimeBudgetWebsiteDialogOpen, setIsAddGlobalTimeBudgetWebsiteDialogOpen] = useState(false);

  const [websiteToDelete, setWebsiteToDelete] = useState("")
  const [deleteGlobalDialogOpen, setDeleteGlobalDialogOpen] = useState(false);
  const [deleteBudgetDialogOpen, setDeleteBudgetDialogOpen] = useState(false);
  const [budgetToDeleteId, setBudgetToDeleteId] = useState<string | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [globalWebsiteToDelete, setGlobalWebsiteToDelete] = useState("")
  const [editingBlockedWebsite, setEditingBlockedWebsite] = useState<BlockedWebsiteRecord | null>(null);

  const [blockedWebsites, setBlockedWebsites] = useState<BlockedWebsiteRecord[]>([]);
  const [groupBudgets, setGroupBudgets] = useState<GroupBudgetRecord[]>([]);
  const [counters, setCounters] = useState<CounterRecord[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);

  const [requirePassword, setRequirePassword] = useState(false);
  const [isPasswordEntryDialogOpen, setIsPasswordEntryDialogOpen] = useState(false);
  const [passwordAction, setPasswordAction] = useState<{ function: (...args: any[]) => void; params: any[]; } | null>(null);
  const [passwordCheck, setPasswordCheck] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [activeTab, setActiveTab] = useState("blockedWebsites");

  const [quotes, setQuotes] = useState<QuoteRecord[] | null>(null);
  const [deleteQuoteDialogOpen, setDeleteQuoteDialogOpen] = useState(false);
  const [addQuoteDialogOpen, setAddQuoteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<QuoteRecord | null>(null);

  const [whiteListPathsEnabled, setWhiteListPathsEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [user, setUser] = useState<User>(new User());

  // Visible (non-deleted) records. Derived views the UI consumes.
  const visibleBlockedWebsites = blockedWebsites.filter((w) => !w.deletedAt);
  const visibleGroupBudgets = groupBudgets.filter((g) => !g.deletedAt);
  const visibleQuotes = quotes ? quotes.filter((q) => !q.deletedAt) : null;

  // Default selectedBudgetId to the first visible budget if it's not set / went stale.
  useEffect(() => {
    if (!selectedBudgetId || !visibleGroupBudgets.find((g) => g.id === selectedBudgetId)) {
      setSelectedBudgetId(visibleGroupBudgets[0]?.id ?? null);
    }
  }, [visibleGroupBudgets, selectedBudgetId]);

  const selectedBudget = visibleGroupBudgets.find((g) => g.id === selectedBudgetId) ?? null;

  // Load user on mount + storage listeners.
  useEffect(() => {
    const loadUser = async () => {
      const loadedUser = await loadUserFromStorage();
      if (loadedUser) setUser(loadedUser);
    };
    loadUser();

    const handleStorageChange = (changes: any, areaName: string) => {
      if (areaName !== 'local') return;

      if (changes.user) {
        const newUser = changes.user.newValue;
        setUser(newUser ? User.fromJSON(newUser) : new User());
      }
      if (changes.blockedWebsites && Array.isArray(changes.blockedWebsites.newValue)) {
        setBlockedWebsites(changes.blockedWebsites.newValue);
      }
      if (changes.groupBudgets && Array.isArray(changes.groupBudgets.newValue)) {
        setGroupBudgets(changes.groupBudgets.newValue);
      }
      if (changes.counters && Array.isArray(changes.counters.newValue)) {
        setCounters(changes.counters.newValue);
      }
      if (changes.quotes && Array.isArray(changes.quotes.newValue)) {
        setQuotes(changes.quotes.newValue);
      }
      if (changes.settings) {
        const newSettings = changes.settings.newValue;
        if (newSettings) {
          setRequirePassword(!!newSettings.password);
          setWhiteListPathsEnabled(newSettings.whiteListPathsEnabled || false);
        }
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    return () => browser.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Subscribe to sync status; trigger initial sync for Pro users.
  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((status) => setSyncStatus(status));
    if (user.extensionsPlus && user.authToken) syncAll(user.authToken);
    return unsubscribe;
  }, [user.extensionsPlus, user.authToken]);

  // Restore active tab from query string.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section === "gmplus") setActiveTab("gmplus");
    else if (section) setActiveTab(section);
  }, []);

  const [ctaDiscordIndex, setCtaDiscordIndex] = useState<number>(1);
  useEffect(() => {
    setCtaDiscordIndex(Math.floor(Math.random() * 6) + 1);
  }, []);
  const ctaDiscordText = t(`options.footer.discordCta${ctaDiscordIndex}` as any);

  const activeLocale = getActiveLocale();
  const handleLocaleChange = (value: string) => {
    void setActiveLocale(value === 'auto' ? null : (value as LocaleCode));
  };

  // Initial load.
  useEffect(() => {
    browser.storage.local.get(['blockedWebsites', 'groupBudgets', 'counters', 'settings', 'quotes'], (data) => {
      if (Array.isArray(data.blockedWebsites)) setBlockedWebsites(data.blockedWebsites);
      if (Array.isArray(data.groupBudgets)) setGroupBudgets(data.groupBudgets);
      if (Array.isArray(data.counters)) setCounters(data.counters);
      if (Array.isArray(data.quotes)) setQuotes(data.quotes);
      if (data.settings) {
        if (data.settings.whiteListPathsEnabled !== undefined) setWhiteListPathsEnabled(data.settings.whiteListPathsEnabled);
        if (data.settings.password) setRequirePassword(true);
      }
    });
  }, []);

  // Blocked websites

  const deleteBlockedWebsite = async () => {
    if (!websiteToDelete) return;
    const now = new Date().toISOString();
    const updated = blockedWebsites.map((w) =>
      w.website === websiteToDelete ? { ...w, deletedAt: now, updatedAt: now, syncedAt: null } : w
    );
    await browser.storage.local.set({ blockedWebsites: updated });
    setBlockedWebsites(updated);
    setWebsiteToDelete("");
    syncBlockedWebsitesBg();
  };

  const handleAddBlockedWebsite = () => {
    setEditingBlockedWebsite(null);
    setIsWebsiteDialogOpen(true);
  };

  const openBlockedWebsiteEditDialog = (website: string) => {
    const record = visibleBlockedWebsites.find((w) => w.website === website) ?? null;
    setEditingBlockedWebsite(record);
    setIsWebsiteDialogOpen(true);
  };

  const handleEditBlockedWebsite = (websiteName: string) => {
    if (requirePassword) {
      setPasswordAction({ function: openBlockedWebsiteEditDialog, params: [websiteName] });
      setIsPasswordEntryDialogOpen(true);
    } else {
      openBlockedWebsiteEditDialog(websiteName);
    }
  };

  const handleDeleteBlockedWebsite = (websiteName: string) => {
    setWebsiteToDelete(websiteName);
    if (requirePassword) {
      setPasswordAction({ function: setDeleteDialogOpen, params: [true] });
      setIsPasswordEntryDialogOpen(true);
    } else {
      setDeleteDialogOpen(true);
    }
  };

  const handleDialogClose = () => {
    setIsWebsiteDialogOpen(false);
    setEditingBlockedWebsite(null);
  };

  // Group budgets

  const handleGlobalTimeBudgetEdit = () => {
    if (requirePassword) {
      setPasswordAction({ function: setIsEditGlobalTimeBudgetDialogOpen, params: [true] });
      setIsPasswordEntryDialogOpen(true);
    } else {
      setIsEditGlobalTimeBudgetDialogOpen(true);
    }
  };

  const handleDeleteGlobalBlockedWebsite = (websiteName: string) => {
    setGlobalWebsiteToDelete(websiteName);
    if (requirePassword) {
      setPasswordAction({ function: setDeleteGlobalDialogOpen, params: [true] });
      setIsPasswordEntryDialogOpen(true);
    } else {
      setDeleteGlobalDialogOpen(true);
    }
  };

  const deleteGlobalTimeBudgetWebsite = async () => {
    if (!globalWebsiteToDelete || !selectedBudget) return;
    const now = new Date().toISOString();
    const newWebsites = selectedBudget.websites.filter((w) => w !== globalWebsiteToDelete);
    const updated = groupBudgets.map((g) =>
      g.id === selectedBudget.id ? { ...g, websites: newWebsites, updatedAt: now, syncedAt: null } : g
    );
    await browser.storage.local.set({ groupBudgets: updated });
    setGroupBudgets(updated);
    setGlobalWebsiteToDelete("");
    syncGroupBudgetsBg();
  };

  const addNewGroupBudget = async () => {
    const now = new Date().toISOString();
    const newBudget: GroupBudgetRecord = {
      id: crypto.randomUUID(),
      name: "",
      websites: [],
      timeAllowed: { 0: 300, 1: 300, 2: 300, 3: 300, 4: 300, 5: 300, 6: 300 },
      blockIncognito: false,
      variableSchedule: false,
      redirectUrl: "",
      scheduledBlockRanges: [],
      updatedAt: now,
      deletedAt: null,
      syncedAt: null,
    };
    const updated = [...groupBudgets, newBudget];
    await browser.storage.local.set({ groupBudgets: updated });
    setGroupBudgets(updated);
    setSelectedBudgetId(newBudget.id);
    syncGroupBudgetsBg();
  };

  const deleteGroupBudget = async (id: string) => {
    if (visibleGroupBudgets.length <= 1) return;
    const now = new Date().toISOString();
    const updated = groupBudgets.map((g) =>
      g.id === id ? { ...g, deletedAt: now, updatedAt: now, syncedAt: null } : g
    );
    await browser.storage.local.set({ groupBudgets: updated });
    setGroupBudgets(updated);
    if (selectedBudgetId === id) {
      const fallback = updated.find((g) => g.id !== id && !g.deletedAt) ?? null;
      setSelectedBudgetId(fallback?.id ?? null);
    }
    syncGroupBudgetsBg();
  };

  const handleDeleteGroupBudget = (id: string) => {
    if (visibleGroupBudgets.length <= 1) return;
    setBudgetToDeleteId(id);
    if (requirePassword) {
      setPasswordAction({ function: setDeleteBudgetDialogOpen, params: [true] });
      setIsPasswordEntryDialogOpen(true);
    } else {
      setDeleteBudgetDialogOpen(true);
    }
  };

  // Settings

  const handleWhiteListPathsEnabled = async (checked: boolean) => {
    setWhiteListPathsEnabled(checked);
    const now = new Date().toISOString();
    const result = (await browser.storage.local.get('settings')) as { settings?: Record<string, any> };
    const settings = { ...(result.settings ?? {}) };
    settings.whiteListPathsEnabled = checked;
    settings.whiteListPathsEnabledUpdatedAt = now;
    await browser.storage.local.set({ settings });
    syncSettingsBg();

    if (!checked) {
      // Clear allowedPaths from every blocked website, mark each unsynced.
      const updated = blockedWebsites.map((w) =>
        w.allowedPaths.length > 0
          ? { ...w, allowedPaths: [], updatedAt: now, syncedAt: null }
          : w
      );
      await browser.storage.local.set({ blockedWebsites: updated });
      setBlockedWebsites(updated);
      syncBlockedWebsitesBg();
    }
  };

  // ─── Password gate ─────────────────────────────────────────────────────

  const handlePasswordEntryDialogChange = () => {
    setIsPasswordEntryDialogOpen(false);
    setPasswordCheck("");
    setErrorMsg("");
  };

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
          setErrorMsg(t("password.incorrect"));
        }
      }
    });
  };

  // Quotes

  const refreshQuotes = () => {
    setAddQuoteDialogOpen(false);
    setQuoteToDelete(null);
    browser.storage.local.get(['quotes'], (data) => {
      if (Array.isArray(data.quotes)) setQuotes(data.quotes);
    });
  };

  const deleteQuote = async () => {
    if (!quoteToDelete || !quotes) return;
    const now = new Date().toISOString();
    const updated = quotes.map((q) =>
      q.id === quoteToDelete.id ? { ...q, deletedAt: now, syncedAt: null } : q
    );
    setQuotes(updated);
    await browser.storage.local.set({ quotes: updated });
    syncQuotesBg();
  };

  const handleForceSync = async () => {
    if (!user.extensionsPlus || !user.authToken) return;
    await syncAll(user.authToken);
  };

  const dayOfTheWeek = (new Date().getDay() + 6) % 7;
  const today = todayDateStr();

  return (
    <>
      <div className='px-4 sm:px-6 md:px-10 flex flex-col min-h-screen max-w-screen-lg mx-auto font-geist'>
        <div className="flex-grow">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className='mt-8 mb-10 flex flex-col md:flex-row md:items-center gap-3 md:gap-0'>
              <img src="/images/logo.svg" alt="Logo" className="w-10 h-10 mr-4" />

              <TabsList className='py-5 px-2 flex flex-col items-stretch gap-1 md:gap-0 h-auto w-full md:inline-flex md:flex-row md:items-center md:h-9 md:w-auto'>
                <TabsTrigger className='w-full justify-start md:w-auto md:justify-center data-[state=active]:shadow-none' value="blockedWebsites"><ShieldBan className='w-5 h-5 mr-1' /> {t('options.tabs.blockedWebsites')}</TabsTrigger>
                <TabsTrigger className='w-full justify-start md:w-auto md:justify-center data-[state=active]:shadow-none' value="globalTimeBudget"><Component className='w-5 h-5 mr-1' /> {t('options.tabs.groupTimeBudget')}</TabsTrigger>
                <TabsTrigger className='w-full justify-start md:w-auto md:justify-center data-[state=active]:shadow-none' value="statistics"><ChartNoAxesColumn className='w-5 h-5 mr-1' /> {t('options.tabs.statistics')} </TabsTrigger>
                <TabsTrigger className='w-full justify-start md:w-auto md:justify-center data-[state=active]:shadow-none' value="settings" ><Settings className='w-5 h-5 mr-1' />  {t('options.tabs.settings')}</TabsTrigger>
                <TabsTrigger className='w-full justify-start md:w-auto md:justify-center data-[state=active]:shadow-none md:ml-1 bg-gradient-to-r from-chart-1 to-chart-3 text-white data-[state=active]:text-white transition-all duration-100 hover:scale-105' value="gmplus" ><Sparkles className='w-5 h-5 mr-1' />  {t('options.tabs.gmPlus')}</TabsTrigger>
              </TabsList>
              {user.extensionsPlus && (
                <div className="flex items-center space-x-3 md:ml-4">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    {syncStatus === "idle" && (<><CheckCircle2 className="w-4 h-4" /><span>{t('options.sync.synced')}</span></>)}
                    {syncStatus === "syncing" && (<><RefreshCw className="w-4 h-4 animate-pulse" /><span>{t('options.sync.syncing')}</span></>)}
                    {syncStatus === "success" && (<><CheckCircle2 className="w-4 h-4" /><span>{t('options.sync.synced')}</span></>)}
                    {syncStatus === "error" && (<><CloudOff className="w-4 h-4 text-destructive" /><span className="text-destructive">{t('options.sync.failed')}</span></>)}
                  </div>
                  <Button
                    onClick={handleForceSync}
                    disabled={syncStatus === "syncing"}
                    size="sm"
                    variant="outline"
                    className="h-8 hover:bg-muted/50 transition-colors shadow-none border-muted-foreground/50 text-muted-foreground"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    {t('options.sync.syncNow')}
                  </Button>
                </div>
              )}
            </div>

            {/* BLOCKED WEBSITES TAB */}
            <TabsContent value="blockedWebsites">
              <div className='flex items-center justify-between mb-5 mt-10'>
                <div className='text-3xl font-bold w-full text-muted-foreground'>{t('options.blockedWebsites.title')}</div>
                <div className='w-full text-right '>
                  <Button onClick={handleAddBlockedWebsite}> <Plus className='h-5 w-5 mr-1' /> {t('options.blockedWebsites.addWebsite')} </Button>

                  <Dialog open={isAddWebsiteDialogOpen} onOpenChange={handleDialogClose}>
                    <DialogContent className="bg-card" >
                      <ScrollArea className="max-h-[800px] ">
                        <div className='bg-card m-2 p-4 rounded-md'>
                          <DialogTitle>{t('options.blockedWebsites.blockTitle')}</DialogTitle>
                          <DialogDescription>
                            <BlockedWebsiteForm existingRecord={editingBlockedWebsite} whiteListPathsEnabled={whiteListPathsEnabled} callback={handleDialogClose} />
                          </DialogDescription>
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 px-5 py-4" >
                <BlockedWebsitesTable
                  blockedWebsites={visibleBlockedWebsites}
                  counters={counters}
                  deleteBlockedWebsite={handleDeleteBlockedWebsite}
                  editBlockedWebsite={handleEditBlockedWebsite}
                />
              </div>

              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="sm:max-w-[425px] p-6">
                  <DialogHeader>
                    <DialogTitle>{t('options.blockedWebsites.deleteTitle')}</DialogTitle>
                    <DialogDescription className='pt-2'>
                      {t('options.blockedWebsites.deleteConfirm')} <span className='font-bold'>{websiteToDelete}</span>?
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className='pt-2'>
                    <Button type="submit" variant={"destructive"} onClick={() => { deleteBlockedWebsite(); setDeleteDialogOpen(false); }}>{t('common.delete')}</Button>
                    <Button type="submit" onClick={() => setDeleteDialogOpen(false)}>{t('common.close')}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* GROUP TIME BUDGETS TAB */}
            <TabsContent value="globalTimeBudget">
              <div className='mt-10 mb-5'>

                <div className='flex items-center justify-between text-3xl font-bold w-full text-muted-foreground mb-8'>
                  <div className='flex items-center'>
                    {t('options.groupTimeBudgets.title')}
                    <TooltipProvider>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild >
                          <button tabIndex={-1} className="flex items-center justify-center ml-2 rounded-full" >
                            <Info className="ml-2 mt-0.5 w-5 h-5 text-chart-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-primary text-foreground p-2 rounded " >
                          {t('options.groupTimeBudgets.tooltipLine1')} <br />
                          {t('options.groupTimeBudgets.tooltipLine2')} <br />
                          {t('options.groupTimeBudgets.tooltipLine3')}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                {visibleGroupBudgets.map((budget, displayIndex) => {
                  const isSelected = selectedBudgetId === budget.id;
                  const budgetUsedToday = totalForTarget(counters, today, 'group_time', budget.id);
                  return (
                    <div
                      key={budget.id}
                      className={`mb-6 p-4 rounded-xl ${isSelected ? 'bg-muted/80 border-2 border-primary' : 'bg-muted/50'} cursor-pointer transition-all`}
                      onClick={() => setSelectedBudgetId(budget.id)}
                    >
                      <div className='flex flex-wrap items-center justify-between gap-2 mb-4'>
                        <div className='text-xl font-bold text-muted-foreground'>
                          {budget.name?.trim() ? budget.name : t('popup.budgetLabel', [displayIndex + 1])}
                          {budget.websites.length > 0 && (
                            <span className='ml-2 text-sm font-normal'>({budget.websites.length === 1 ? t('options.groupTimeBudgets.websiteCountOne', [budget.websites.length]) : t('options.groupTimeBudgets.websiteCountOther', [budget.websites.length])})</span>
                          )}
                        </div>
                        <div className='flex items-center gap-2 flex-wrap'>
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelectedBudgetId(budget.id); handleGlobalTimeBudgetEdit(); }}>
                            <Pencil className='h-4 w-4 mr-2' /> {t('options.groupTimeBudgets.edit')}
                          </Button>
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelectedBudgetId(budget.id); setIsAddGlobalTimeBudgetWebsiteDialogOpen(true); }}>
                            <Plus className='h-5 w-5 mr-1' /> {t('options.groupTimeBudgets.addWebsite')}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={visibleGroupBudgets.length <= 1}
                            onClick={(e) => { e.stopPropagation(); handleDeleteGroupBudget(budget.id); }}
                          >
                            {t('options.groupTimeBudgets.deleteBudget')}
                          </Button>
                        </div>
                      </div>

                      <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:flex lg:items-stretch w-full gap-4'>
                        <Card className="flex-1">
                          <CardHeader className="p-5">
                            <CardTitle>{t('options.groupTimeBudgets.allowedPerDay')}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-5 pt-0 flex flex-wrap">
                            {budget.variableSchedule ? (
                              Array.from({ length: 7 }, (_, i) => (
                                <div key={i} className="flex flex-col items-center mx-1 mt-1">
                                  <div className={i === dayOfTheWeek ? "w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 m-1 flex flex-col items-center justify-center rounded-full cursor-pointer bg-primary text-muted-foreground select-none" : "w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 m-1 flex flex-col items-center justify-center rounded-full cursor-pointer bg-background text-muted-foreground select-none"}>
                                    {dayShort[i]}
                                    <div className="text-[0.65rem] md:text-[0.8rem]">{timeDisplayFormat(budget.timeAllowed[i] ?? 0, true)}</div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className='text-2xl font-medium text-muted-foreground'>{timeDisplayFormat(budget.timeAllowed[0] ?? 0)}</div>
                            )}
                          </CardContent>
                        </Card>

                        <Card className="flex-1">
                          <CardHeader className="p-5">
                            <CardTitle>{t('options.groupTimeBudgets.timeLeftToday')}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-5 pt-0">
                            <div className='text-2xl font-medium text-muted-foreground'>{timeDisplayFormat((budget.timeAllowed[dayOfTheWeek] ?? 0) - budgetUsedToday)}</div>
                          </CardContent>
                        </Card>

                        <Card className="flex-1">
                          <CardHeader className="p-5">
                            <CardTitle>{t('options.groupTimeBudgets.redirectsTo')}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-5 pt-0">
                            <div className='text-2xl font-medium text-muted-foreground'>{budget.redirectUrl === "" ? t('common.inspiration') : budget.redirectUrl}</div>
                          </CardContent>
                        </Card>

                        <Card className="flex-1">
                          <CardHeader className="p-5">
                            <CardTitle>{t('options.groupTimeBudgets.blockInIncognito')}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-5 pt-0">
                            <div className='text-2xl font-medium text-muted-foreground'>{budget.blockIncognito ? t('common.yes') : t('common.no')}</div>
                          </CardContent>
                        </Card>

                        <Card className="flex-1">
                          <CardHeader className="p-5">
                            <CardTitle>{t('options.groupTimeBudgets.scheduledBlock')}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-5 pt-0 flex flex-wrap">
                            <div className='text-lg font-medium text-muted-foreground'>
                              {budget.scheduledBlockRanges.length === 0 && t('common.none')}
                              {budget.scheduledBlockRanges.map((range, index) => (
                                <div key={index} className={index !== budget.scheduledBlockRanges.length - 1 ? "mb-5" : ""}>
                                  {scheduledBlockDisplay(range)}
                                  <div className="flex flex-wrap items-center text-sm font-normal">
                                    {range.days.every((day: boolean) => day) ? (
                                      <div className="text-muted-foreground">{t('common.everyDay')}</div>
                                    ) : (
                                      Array.from({ length: 7 }, (_, i) => (
                                        <div key={i} className="flex flex-col items-center">
                                          <div className={range.days[i] ? "w-7 h-7 mr-1 mt-1 flex flex-col items-center justify-center rounded-full cursor-pointer bg-primary text-muted-foreground select-none" : "w-7 h-7 mr-1 mt-1 flex flex-col items-center justify-center rounded-full cursor-pointer bg-background text-muted-foreground select-none"}>
                                            {dayShort[i]}
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

                      {budget.websites.length > 0 && (
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

                <div className="flex justify-center mt-8">
                  <Button onClick={addNewGroupBudget} className="rounded-full w-14 h-14 p-0" size="lg">
                    <Plus className='h-8 w-8' />
                  </Button>
                </div>

                <Dialog open={isEditGlobalTimeBudgetDialogOpen} onOpenChange={() => { setIsEditGlobalTimeBudgetDialogOpen(false) }}>
                  <DialogContent className="bg-card" >
                    <ScrollArea className="max-h-[800px] ">
                      <div className='bg-card m-2 p-4 rounded-md'>
                        <DialogTitle>{t('options.groupTimeBudgets.setupTitle')}</DialogTitle>
                        <DialogDescription>
                          {selectedBudget && (
                            <GlobalTimeBudgetForm
                              existingBudget={selectedBudget}
                              callback={() => setIsEditGlobalTimeBudgetDialogOpen(false)}
                            />
                          )}
                        </DialogDescription>
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>

                <Dialog open={isAddGlobalTimeBudgetWebsiteDialogOpen} onOpenChange={() => { setIsAddGlobalTimeBudgetWebsiteDialogOpen(false) }}>
                  <DialogContent className="bg-card" >
                    <ScrollArea className="max-h-[800px] ">
                      <div className='bg-card m-2 p-4 rounded-md'>
                        <DialogTitle>{t('options.groupTimeBudgets.addWebsiteTitle')}</DialogTitle>
                        <DialogDescription>
                          {selectedBudget && (
                            <GlobalTimeBudgetWebsiteForm
                              budgetId={selectedBudget.id}
                              callback={() => setIsAddGlobalTimeBudgetWebsiteDialogOpen(false)}
                            />
                          )}
                        </DialogDescription>
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>

              <Dialog open={deleteGlobalDialogOpen} onOpenChange={setDeleteGlobalDialogOpen}>
                <DialogContent className="sm:max-w-[425px] p-6">
                  <DialogHeader>
                    <DialogTitle>{t('options.groupTimeBudgets.deleteWebsiteTitle')}</DialogTitle>
                    <DialogDescription className='pt-2'>
                      {t('options.groupTimeBudgets.deleteWebsiteConfirm')} <span className='font-bold'>{globalWebsiteToDelete}</span>?
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className='pt-2'>
                    <Button type="submit" variant={"destructive"} onClick={() => { deleteGlobalTimeBudgetWebsite(); setDeleteGlobalDialogOpen(false); }}>{t('common.delete')}</Button>
                    <Button type="submit" onClick={() => setDeleteGlobalDialogOpen(false)}>{t('common.close')}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={deleteBudgetDialogOpen} onOpenChange={setDeleteBudgetDialogOpen}>
                <DialogContent className="sm:max-w-[425px] p-6">
                  <DialogHeader>
                    <DialogTitle>{t('options.groupTimeBudgets.deleteBudgetTitle')}</DialogTitle>
                    <DialogDescription className='pt-2'>
                      {t('options.groupTimeBudgets.deleteBudgetConfirm', [visibleGroupBudgets.find(g => g.id === budgetToDeleteId)?.websites.length || 0])}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className='pt-2'>
                    <Button type="submit" variant={"destructive"} onClick={() => {
                      if (budgetToDeleteId) deleteGroupBudget(budgetToDeleteId);
                      setDeleteBudgetDialogOpen(false);
                    }}>{t('options.groupTimeBudgets.deleteBudget')}</Button>
                    <Button type="submit" onClick={() => setDeleteBudgetDialogOpen(false)}>{t('common.close')}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* STATISTICS TAB */}
            <TabsContent value="statistics">
              <div className='mt-10 mb-5'>
                <div className='text-3xl font-bold w-full text-muted-foreground'>{t('options.statistics.title')}</div>
                <StatsOverview counters={counters} />
                <div className='mt-8 bg-muted/50 p-5 rounded-xl'>
                  <div className='mb-5'>
                    <RestrictedPerDayChart counters={counters} />
                  </div>
                  <div>
                    <BlockedPerDayChart counters={counters} />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* SETTINGS TAB */}
            <TabsContent value="settings">
              <div className='mt-10 mb-5'>
                <div className='text-3xl font-bold w-full text-muted-foreground'>{t('options.settings.title')}</div>

                <div className='mt-8 bg-muted/50 p-5 rounded-xl'>
                  <div className="flex items-center justify-between max-w-[350px] w-full">
                    <Label className='text-base' htmlFor="languageSelect">{t('options.language')}</Label>
                    <select
                      id="languageSelect"
                      value={activeLocale ?? 'auto'}
                      onChange={(e) => handleLocaleChange(e.target.value)}
                      className="w-[180px] max-w-[55%] bg-background border border-input rounded-md px-3 py-2 text-sm"
                    >
                      <option value="auto">{t('options.languageAuto')}</option>
                      {SUPPORTED_LOCALES.map((loc) => (
                        <option key={loc.code} value={loc.code}>
                          {loc.nativeName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-6">
                    <PasswordProtection
                      requirePassword={requirePassword}
                      setRequirePassword={setRequirePassword}
                    />
                  </div>
                </div>

                <div className='mt-4 bg-muted/50 p-5 rounded-xl'>
                  <QuotesTable
                    quotes={visibleQuotes}
                    addQuote={() => { setAddQuoteDialogOpen(true) }}
                    deleteQuote={(record) => { setQuoteToDelete(record); setDeleteQuoteDialogOpen(true); }}
                  />
                </div>

                <Accordion type="single" collapsible className="w-full bg-muted/50 p-4 mt-4 rounded-2xl">
                  <AccordionItem value="item-1">
                    <AccordionTrigger className='text-base'>{t('options.settings.advancedSettings')}</AccordionTrigger>
                    <AccordionContent>
                      <div className="flex items-center justify-between max-w-[350px] w-full mt-4">
                        <div className="flex items-center">
                          <Label className='text-base' htmlFor="whiteListPathsEnabled">{t('options.settings.whitelistPaths')}</Label>
                          <TooltipProvider>
                            <Tooltip delayDuration={0}>
                              <TooltipTrigger asChild>
                                <button className="flex items-center justify-center ml-2 rounded-full">
                                  <Info className="w-4 h-4 text-chart-5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-primary text-foreground p-2 rounded">
                                {t('options.settings.whitelistPathsTooltip')}
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

            <TabsContent value="gmplus">
              <GMPlus />
            </TabsContent>

            <Dialog open={addQuoteDialogOpen} onOpenChange={() => { setAddQuoteDialogOpen(false) }}>
              <DialogContent className="bg-card" >
                <ScrollArea className="max-h-[800px] ">
                  <div className='bg-card m-2 p-4 rounded-md'>
                    <DialogTitle>{t('options.quotesDialog.addTitle')}</DialogTitle>
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
                  <DialogTitle>{t('options.quotesDialog.deleteTitle')}</DialogTitle>
                  <DialogDescription className='pt-2'>
                    {t('options.quotesDialog.deleteConfirm')} <span className='font-bold'>{quoteToDelete?.quote}  - {quoteToDelete?.author}</span>?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className='pt-2'>
                  <Button type="submit" variant={"destructive"} onClick={() => { deleteQuote(); setDeleteQuoteDialogOpen(false); }}>{t('common.delete')}</Button>
                  <Button type="submit" onClick={() => setDeleteQuoteDialogOpen(false)}>{t('common.close')}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Tabs>
        </div>

        <Dialog open={isPasswordEntryDialogOpen} onOpenChange={handlePasswordEntryDialogChange} >
          <DialogContent className="bg-card" >
            <div className='bg-card m-2 p-4 rounded-md'>
              <DialogTitle>{t('options.passwordDialog.title')}</DialogTitle>
              <DialogDescription>
                <div className="w-[99%] mx-auto">
                  <div className="mt-5">
                    <div className="mt-5 flex items-center" >
                      <Label htmlFor="password">{t('options.passwordDialog.password')}</Label>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild >
                            <button tabIndex={-1} className="flex items-center justify-center ml-2 rounded-full" >
                              <Info className="w-4 h-4 text-chart-5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-primary text-foreground p-2 rounded " >
                            {t('options.passwordDialog.tooltip')}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input
                      className='mt-2'
                      type='password'
                      id="passwordCheck"
                      value={passwordCheck}
                      placeholder={t('options.passwordDialog.placeholder')}
                      onChange={(e) => setPasswordCheck(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordCheck(); }}
                    />
                    <div className='w-full text-right mb-2'>
                      <Button className="mt-5" onClick={() => handlePasswordCheck()}> {t('options.passwordDialog.disable')} </Button>
                    </div>
                    {errorMsg && <p className="text-red-500 text-sm mt-2"> {errorMsg} </p>}
                  </div>
                </div >
              </DialogDescription>
            </div>
          </DialogContent>
        </Dialog>

        <footer className="bg-muted rounded-t-lg py-5 px-8 mt-10">
          <div className="container mx-auto flex flex-col sm:flex-row gap-3 sm:gap-0 justify-between items-center text-center text-xs">
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
