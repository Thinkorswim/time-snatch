import { useState, useEffect } from 'react'
import './style.css';
import '~/assets/global.css';
import { extractHostnameAndDomain } from '@/lib/utils'
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ProgressGlobal } from '@/components/ui/progress-global'
import { Cog, ShieldBan, Component, ChartNoAxesColumn, Sparkles } from 'lucide-react'
import {
  syncBlockedWebsites,
  syncGroupBudgets,
  syncCounters,
  type BlockedWebsiteRecord,
  type GroupBudgetRecord,
  type CounterRecord,
} from '@/lib/sync';
import { totalForTarget, todayDateStr } from '@/lib/counters';
import { t, useLocale } from '@/lib/i18n';

function Popup() {
  useLocale();
  document.body.classList.add('w-[300px]')

  const [blockedWebsites, setBlockedWebsites] = useState<BlockedWebsiteRecord[]>([]);
  const [groupBudgets, setGroupBudgets] = useState<GroupBudgetRecord[]>([]);
  const [counters, setCounters] = useState<CounterRecord[]>([]);
  const [highlightedWebsite, setHighlightedWebsite] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('blockedWebsites');
  const [extensionsPlusUser, setIsProUser] = useState(false);

  const today = todayDateStr();

  const openStatisticsPage = () => {
    const url = browser.runtime.getURL('/options.html?section=statistics');
    browser.tabs.create({ url });
  };

  // Sort visible websites - highlighted first, then the rest in insertion order.
  const visibleBlockedWebsites = blockedWebsites.filter((w) => !w.deletedAt);
  const orderedBlockedWebsites = highlightedWebsite
    ? [
        ...visibleBlockedWebsites.filter((w) => w.website === highlightedWebsite),
        ...visibleBlockedWebsites.filter((w) => w.website !== highlightedWebsite),
      ]
    : visibleBlockedWebsites;

  const visibleGroupBudgets = groupBudgets.filter((g) => !g.deletedAt);

  // Apply current-tab highlight + auto-tab-switch logic.
  const applyCurrentTabHighlight = (websites: BlockedWebsiteRecord[], budgets: GroupBudgetRecord[]) => {
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs?.[0]?.url) return;
      const website = extractHostnameAndDomain(tabs[0].url);
      if (!website) return;

      const isInBlocked = websites.some((w) => !w.deletedAt && w.website === website);
      if (isInBlocked) {
        setHighlightedWebsite(website);
        return;
      }

      const isInGroup = budgets.some((g) => !g.deletedAt && g.websites.includes(website));
      if (isInGroup) {
        setActiveTab('globalTimeBudget');
      }
    });
  };

  useEffect(() => {
    browser.runtime.connect();

    browser.storage.local.get(["user", "blockedWebsites", "groupBudgets", "counters"], async (data) => {
      if (data.user?.extensionsPlus) setIsProUser(true);

      const websites: BlockedWebsiteRecord[] = Array.isArray(data.blockedWebsites) ? data.blockedWebsites : [];
      const budgets: GroupBudgetRecord[] = Array.isArray(data.groupBudgets) ? data.groupBudgets : [];
      const counterRows: CounterRecord[] = Array.isArray(data.counters) ? data.counters : [];

      setBlockedWebsites(websites);
      setGroupBudgets(budgets);
      setCounters(counterRows);
      applyCurrentTabHighlight(websites, budgets);

      // Pull fresh data + counters from server in background for Pro users.
      if (data.user?.extensionsPlus && data.user?.authToken) {
        const token = data.user.authToken;
        Promise.all([
          syncBlockedWebsites(token),
          syncGroupBudgets(token),
          syncCounters(token),
        ]).then(async () => {
          const fresh = await browser.storage.local.get(["blockedWebsites", "groupBudgets", "counters"]);
          if (Array.isArray(fresh.blockedWebsites)) setBlockedWebsites(fresh.blockedWebsites);
          if (Array.isArray(fresh.groupBudgets)) setGroupBudgets(fresh.groupBudgets);
          if (Array.isArray(fresh.counters)) setCounters(fresh.counters);
          applyCurrentTabHighlight(
            Array.isArray(fresh.blockedWebsites) ? fresh.blockedWebsites : websites,
            Array.isArray(fresh.groupBudgets) ? fresh.groupBudgets : budgets,
          );
        }).catch(() => {});
      }
    });

    // Live updates from background ticks.
    const handleStorageChange = (changes: any, areaName: string) => {
      if (areaName !== 'local') return;
      if (Array.isArray(changes.counters?.newValue)) setCounters(changes.counters.newValue);
      if (Array.isArray(changes.blockedWebsites?.newValue)) setBlockedWebsites(changes.blockedWebsites.newValue);
      if (Array.isArray(changes.groupBudgets?.newValue)) setGroupBudgets(changes.groupBudgets.newValue);
    };
    browser.storage.onChanged.addListener(handleStorageChange);
    return () => browser.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  return (
    <div className='w-full font-geist'>
      <div className='mb-2 py-3 flex items-center px-4 bg-muted/80 rounded-b-2xl'>
        <div className='h-full w-full flex items-center justify-start '>
          <img src="/images/logo.svg" alt="Logo" className="w-5 h-5 mb-0.5" />
          <div className='text-chart-1 ml-2 font-black text-base'>Time Snatch</div>
        </div>
        {extensionsPlusUser ? (
          <span
            onClick={() => {
              const url = browser.runtime.getURL('/options.html?section=gmplus');
              browser.tabs.create({ url });
            }}
            className="mr-1 cursor-pointer px-2 text-center py-0.5 w-24 text-xs bg-gradient-to-r from-chart-1 to-chart-3 text-white rounded-full font-semibold flex items-center justify-center transition-all duration-100 hover:scale-105"
          >
            <Sparkles className="inline-block w-3 h-3 mr-1" />
            {t('popup.plus')}
          </span>
        ) : (
          <span
            onClick={() => {
              const url = browser.runtime.getURL('/options.html?section=gmplus');
              browser.tabs.create({ url });
            }}
            className="mr-1 cursor-pointer w-36 px-1.5 text-center py-0.5 text-xs border  bg-gradient-to-r from-chart-1 to-chart-3 text-white border-chart-1/50 rounded-full font-semibold flex items-center justify-center transition-all duration-100 hover:scale-105"
          >
            <Sparkles className="inline-block w-3 h-3 mr-1" />
            {t('popup.getPlus')}
          </span>
        )}
        <div className='flex items-center justify-end'>
          <ChartNoAxesColumn className='w-5 h-5 text-chart-1 cursor-pointer mr-1' onClick={openStatisticsPage} />
          <Cog className='w-5 h-5 text-chart-1 cursor-pointer' onClick={() => browser.runtime.openOptionsPage()} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="blockedWebsites">
        <div className='flex items-center justify-center w-full mb-1'>
          <TabsList className='max-w-full mx-1 h-auto'>
            <TabsTrigger className='min-w-0 whitespace-normal leading-tight text-center data-[state=active]:shadow-none data-[state=active]:text-muted-foreground text-muted-foreground text-xs' value="blockedWebsites"><ShieldBan className='w-5 h-5 mr-1 shrink-0' /> {t('popup.blockedWebsites')} </TabsTrigger>
            <TabsTrigger className='min-w-0 whitespace-normal leading-tight text-center data-[state=active]:shadow-none data-[state=active]:text-muted-foreground text-muted-foreground text-xs' value="globalTimeBudget"><Component className='w-5 h-5 mr-1 shrink-0' /> {t('popup.groupBudget')}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="blockedWebsites">
          <div className="min-h-64">
            <ScrollArea type="always" className="h-[300px] ">
              {orderedBlockedWebsites.length > 0 ? (
                orderedBlockedWebsites.map((record, index) => {
                  const usedToday = totalForTarget(counters, today, 'website_time', record.website);
                  return (
                    <Progress
                      key={record.website}
                      blockedWebsite={record}
                      usedToday={usedToday}
                      className={`w-[90%] mx-auto mb-2 font-medium ${index === 0 && record.website === highlightedWebsite ? 'border-2 border-chart-3' : ''}`}
                    />
                  );
                })
              ) : (
                <p className="text-center text-muted-foreground text-sm">{t('popup.noBlockedWebsites')}</p>
              )}
            </ScrollArea>
          </div>
        </TabsContent>
        <TabsContent value="globalTimeBudget">
          <div className="min-h-64">
            <ScrollArea type="always" className="h-[300px]">
              {visibleGroupBudgets.length > 0 ? (
                visibleGroupBudgets.map((budget, displayIndex) => {
                  if (budget.websites.length === 0) return null;
                  const usedToday = totalForTarget(counters, today, 'group_time', budget.id);
                  const label = budget.name?.trim() ? budget.name : t('popup.budgetLabel', [displayIndex + 1]);
                  return (
                    <div key={budget.id} className="mb-4">
                      <div className="text-xs font-bold text-muted-foreground px-5 mb-1">{label}</div>
                      {budget.websites.map((website, index) => (
                        <ProgressGlobal
                          key={`${budget.id}-${index}`}
                          globalTimeBudget={budget}
                          website={website}
                          usedToday={usedToday}
                          className={`w-[90%] mx-auto mb-2 font-medium`}
                        />
                      ))}
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-muted-foreground text-sm">{t('popup.noGroupBudgetWebsites')}</p>
              )}
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>

      <div className="bg-muted/50 rounded-3xl py-2 px-3 mx-1 mt-1 mb-2">
        <div className="container mx-auto flex justify-between items-center text-xs">
          <a
            href="https://groundedmomentum.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-chart-1 font-semibold"
          >
            <img
              src="/images/gm_logo.svg"
              alt="Grounded Momentum Logo"
              className="w-5 h-5 mr-1"
            />
            groundedmomentum.com
          </a>
          <div className="flex items-center font-semibold">
            <Button
              className="h-7 gap-2 rounded-lg px-2 py-1 text-xs bg-chart-1 hover:bg-chart-1/70 text-white"
              onClick={() => {
                window.open("https://discord.gg/SvTsqKwsgN", "_blank");
              }}
            >
              <img
                height="16"
                width="16"
                src="https://cdn.simpleicons.org/discord/ffffff"
              />
              Discord
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Popup;
