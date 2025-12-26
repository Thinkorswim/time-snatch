import { useState, useEffect } from 'react'
import './style.css';
import '~/assets/global.css';
import { BlockedWebsite } from '@/models/BlockedWebsite'
import { GlobalTimeBudget } from '@/models/GlobalTimeBudget'
import { extractHostnameAndDomain } from '@/lib/utils'
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProgressGlobal } from '@/components/ui/progress-global'
import { Cog, ShieldBan, Component, ChartNoAxesColumn, Sparkles } from 'lucide-react'
import { storage } from 'wxt/storage';
import { syncWebsites } from '@/lib/sync';
import { User } from '@/models/User';


function Popup() {

  // Fix popup width
  document.body.classList.add('w-[300px]')

  const [blockedWebsitesList, setBlockedWebsitesList] = useState<Record<string, BlockedWebsite>>({});
  const [groupTimeBudgets, setGroupTimeBudgets] = useState<GlobalTimeBudget[]>([]);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [activeTab, setActiveTab] = useState('blockedWebsites');
  const [isProUser, setIsProUser] = useState(false);

  const openStatisticsPage = () => {
    const url = browser.runtime.getURL('/options.html?section=statistics');
    browser.tabs.create({ url });
  }


  useEffect(() => {
    browser.runtime.connect();

    // Retrieve user and website data from storage
    browser.storage.local.get(["user", "blockedWebsitesList", "groupTimeBudgets"], async (data) => {
      // Set Pro user status
      if (data.user?.isPro) {
        setIsProUser(true);
      }
      
      // Sync website data if user is Pro
      if (data.user?.isPro && data.user?.authToken) {
        await syncWebsites(data.user.authToken);
        // Re-fetch data after sync
        const updatedData = await browser.storage.local.get(["blockedWebsitesList", "groupTimeBudgets"]);
        Object.assign(data, updatedData);
      }
      if (data.blockedWebsitesList) {
        setBlockedWebsitesList(data.blockedWebsitesList);

        browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs.length > 0 && tabs[0].url) {
            const website = extractHostnameAndDomain(tabs[0].url);
            if (website) {
              const websites = Object.keys(data.blockedWebsitesList);
              if (websites.includes(website)) {
                const updatedBlockedWebsitesList = {
                  [website]: data.blockedWebsitesList[website],
                  ...Object.fromEntries(Object.entries(data.blockedWebsitesList).filter(([key]) => key !== website))
                };
                setBlockedWebsitesList(updatedBlockedWebsitesList);
                setIsHighlighted(true);
              } else if (data.groupTimeBudgets && Array.isArray(data.groupTimeBudgets)) {
                // Check if current website is in any group budget
                const budgets = data.groupTimeBudgets.map((b: any) => GlobalTimeBudget.fromJSON(b));
                const isInGroupBudget = budgets.some(budget => budget.websites.has(website));
                if (isInGroupBudget) {
                  setActiveTab('globalTimeBudget');
                }
              }
            }
          }
        });
      }

      if (data.groupTimeBudgets && Array.isArray(data.groupTimeBudgets)) {
        const budgets = data.groupTimeBudgets.map((b: any) => GlobalTimeBudget.fromJSON(b));
        setGroupTimeBudgets(budgets);
      }
    });
  }, []);

  return (
    <div className='w-full font-geist'>
      <div className='mb-5 py-3 flex items-center px-4 bg-muted/80 rounded-b-2xl'>
        <div className='h-full w-full flex items-center justify-start '>
          <img src="/images/logo.svg" alt="Logo" className="w-5 h-5 mb-0.5" />
          <div className='text-chart-1 ml-2 font-black text-base'>
            Time Snatch
          </div>
        </div>
        {isProUser ? (
          <span className="mr-1 px-2 text-center py-0.5 w-24 text-xs bg-gradient-to-r from-chart-1 to-chart-3 text-white rounded-full font-semibold flex items-center justify-center">
            <Sparkles className="inline-block w-3 h-3 mr-1" />
            Plus
          </span>
        ) : (
          <span
            onClick={() => browser.runtime.openOptionsPage()}
            className="mr-1 cursor-pointer w-36 px-1.5 text-center py-0.5 text-xs border text-chart-1 border-chart-1/50 rounded-full font-semibold flex items-center justify-center"
          >
            <Sparkles className="inline-block w-3 h-3 mr-1" />
            Get Plus
          </span>
        )}
        <div className='flex items-center justify-end'>
          <ChartNoAxesColumn className='w-5 h-5 text-chart-1 cursor-pointer mr-1' onClick={openStatisticsPage} />
          <Cog className='w-5 h-5 text-chart-1 cursor-pointer' onClick={() => browser.runtime.openOptionsPage()} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="blockedWebsites">
        <TabsContent value="blockedWebsites">
          <div className="min-h-64">
            <ScrollArea type="always" className="h-[300px] ">
              {Object.keys(blockedWebsitesList).length > 0 ? (
                Object.entries(blockedWebsitesList).map(([websiteName, blockedWebsite], index) => (
                  <Progress
                    key={websiteName}
                    blockedWebsite={blockedWebsite}
                    className={`w-[90%] mx-auto mb-2 font-medium ${index === 0 && isHighlighted ? 'border-2 border-chart-3' : ''}`}
                  />
                ))
              ) : (
                <p className="text-center text-muted-foreground text-sm">No blocked websites to display.</p>
              )}
            </ScrollArea>
          </div>
        </TabsContent>
        <TabsContent value="globalTimeBudget">
          <div className="min-h-64">
            <ScrollArea type="always" className="h-[300px]">
              {groupTimeBudgets.length > 0 ? (
                groupTimeBudgets.map((budget, budgetIndex) => (
                  <div key={budgetIndex} className="mb-4">
                    {budget.websites.size > 0 && (
                      <>
                        <div className="text-xs font-bold text-muted-foreground px-5 mb-1">
                          Budget {budgetIndex + 1}
                        </div>
                        {Array.from(budget.websites).map((website, index) => (
                          <ProgressGlobal
                            key={`${budgetIndex}-${index}`}
                            globalTimeBudget={budget}
                            website={website}
                            className={`w-[90%] mx-auto mb-2 font-medium`}
                          />
                        ))}
                      </>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground text-sm">No group budget websites to display.</p>
              )}

            </ScrollArea>
          </div>
        </TabsContent>
        <div className='flex items-center justify-center w-full mt-1'>
          <TabsList className='mb-1.5 mx-auto'>
            <TabsTrigger className='data-[state=active]:shadow-none data-[state=active]:text-muted-foreground text-muted-foreground text-xs' value="blockedWebsites"><ShieldBan className='w-5 h-5 mr-1' /> Blocked Websites </TabsTrigger>
            <TabsTrigger className='data-[state=active]:shadow-none data-[state=active]:text-muted-foreground text-muted-foreground text-xs' value="globalTimeBudget"><Component className='w-5 h-5 mr-1' /> Group Budget</TabsTrigger>
          </TabsList>
        </div>

      </Tabs>

    </div>
  )
}

export default Popup;
