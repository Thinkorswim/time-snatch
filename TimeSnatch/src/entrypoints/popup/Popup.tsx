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
import { Cog, ShieldBan, Component} from 'lucide-react'
import { storage } from 'wxt/storage';


function Popup() {

  // Fix popup width
  document.body.classList.add('w-[300px]')

  const [blockedWebsitesList, setBlockedWebsitesList] = useState<Record<string, BlockedWebsite>>({});
  const [globalTimeBudget, setGlobalTimeBudget] = useState<GlobalTimeBudget | null>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [activeTab, setActiveTab] = useState('blockedWebsites');

  useEffect(() => {
    chrome.runtime.connect();
    
    // Retrieve the list of blocked websites from storage
    chrome.storage.local.get(["blockedWebsitesList", "globalTimeBudget"], (data) => {
      if (data.blockedWebsitesList) {
        setBlockedWebsitesList(data.blockedWebsitesList);

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
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
              } else if (data.globalTimeBudget && GlobalTimeBudget.fromJSON(data.globalTimeBudget).websites.has(website)) {
                setActiveTab('globalTimeBudget');
              }
            }
          }
        });
      }

      if (data.globalTimeBudget) {
        setGlobalTimeBudget(GlobalTimeBudget.fromJSON(data.globalTimeBudget));
      }
    });
  }, []);

  return (
    <div className='w-full font-geist'>
      <div className='mb-5 py-3 flex items-center px-5 bg-muted/80 rounded-b-2xl'>
        <div className='h-full w-full flex items-center justify-start '>
          <img src="/images/logo.svg" alt="Logo" className="w-5 h-5 mb-0.5" />
          <div className='text-chart-1 ml-2 font-black text-base'>
            Time Snatch
          </div>
        </div>
        <div className='flex items-center justify-end'>
          <Cog className='w-5 h-5 text-chart-1 cursor-pointer' onClick={() => chrome.runtime.openOptionsPage()} />
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
              {globalTimeBudget && globalTimeBudget.websites.size > 0 ? (
                Array.from(globalTimeBudget.websites).map((website, index) => (
                  <ProgressGlobal
                    key={index}
                    globalTimeBudget={globalTimeBudget}
                    website={website}
                    className={`w-[90%] mx-auto mb-2 font-medium`}
                  />
                ))) : (
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
