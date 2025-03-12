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
import { Plus, Pencil, Info, ShieldBan, Component, Activity } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GlobalTimeBudget } from '@/models/GlobalTimeBudget'
import { timeDisplayFormat, scheduledBlockDisplay } from '@/lib/utils'
import { GlobalTimeBudgetWebsiteForm } from '@/components/custom/GlobalTimeBudgetWebsiteForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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



  // Ensure data is synced on focus
  useEffect(() => {
    const handleFocus = () => {
      chrome.storage.local.get(["blockedWebsitesList", "globalTimeBudget"], (data) => {
        if (data.blockedWebsitesList) {
          setBlockedWebsitesList(data.blockedWebsitesList);
        }

        if (data.globalTimeBudget) {
          setGlobalTimeBudget(GlobalTimeBudget.fromJSON(data.globalTimeBudget));
        }
      });
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const refreshBlockedWebsitesList = () => {
    setIsWebsiteDialogOpen(false);
    setBlockedWebsite(null);

    chrome.storage.local.get(['blockedWebsitesList'], (data) => {
      if (data.blockedWebsitesList) {
        setBlockedWebsitesList(data.blockedWebsitesList);
        chrome.storage.sync.set({ blockedWebsitesList: data.blockedWebsitesList });
      }
    });

  }

  const refreshGlobalTimeBudget = () => {
    setIsEditGlobalTimeBudgetDialogOpen(false);
    setIsAddGlobalTimeBudgetWebsiteDialogOpen(false);

    chrome.storage.local.get(['globalTimeBudget'], (data) => {
      if (data.globalTimeBudget) {
        const globalTimeBudget = GlobalTimeBudget.fromJSON(data.globalTimeBudget);
        setGlobalTimeBudget(globalTimeBudget);
        chrome.storage.sync.set({ globalTimeBudget: globalTimeBudget.toJSON() });
      }
    });
  }

  const deleteBlockedWebsite = () => {
    if (!websiteToDelete) return;

    const newBlockedWebsitesList = { ...blockedWebsitesList };
    delete newBlockedWebsitesList[websiteToDelete];

    chrome.storage.local.set({ blockedWebsitesList: newBlockedWebsitesList }, () => {
      setBlockedWebsitesList(newBlockedWebsitesList);
      setWebsiteToDelete("");
    });
  }


  const deleteGlobalTimeBudgetWebsite = () => {
    if (!globalWebsiteToDelete || !globalTimeBudget) return;

    globalTimeBudget.websites.delete(globalWebsiteToDelete)

    chrome.storage.local.set({ globalTimeBudget: globalTimeBudget.toJSON() }, () => {
      setGlobalTimeBudget(globalTimeBudget);
      setGlobalWebsiteToDelete("");
    });
  }

  const editBlockedWebsite = (websiteName: string) => {
    setBlockedWebsite(blockedWebsitesList[websiteName]);
    setIsWebsiteDialogOpen(true);
  }

  const handleDialogClose = () => {
    setIsWebsiteDialogOpen(false);
    setBlockedWebsite(null);
  };

  useEffect(() => {
    // Retrieve the list of blocked websites from storage
    chrome.storage.local.get(['blockedWebsitesList', 'globalTimeBudget'], (data) => {
      if (data.blockedWebsitesList) {
        setBlockedWebsitesList(data.blockedWebsitesList);
      }

      if (data.globalTimeBudget) {
        const globalTimeBudget = GlobalTimeBudget.fromJSON(data.globalTimeBudget);
        setGlobalTimeBudget(globalTimeBudget);
      }
    });
  }, []);

  return (
    <div className='px-10 flex flex-col min-h-screen max-w-screen-lg mx-auto font-geist'>

      <div className="flex-grow">

        <Tabs defaultValue="blockedWebsites">
          <div className='mt-8 mb-10 flex items-center'>
            <img src="/images/logo.svg" alt="Logo" className="w-10 h-10 mr-4" />

            <TabsList className='py-5 px-2'>

              <TabsTrigger className='data-[state=active]:shadow-none' value="blockedWebsites"><ShieldBan className='w-5 h-5 mr-1' /> Blocked Websites</TabsTrigger>
              <TabsTrigger className='data-[state=active]:shadow-none' value="globalTimeBudget"><Component className='w-5 h-5 mr-1' /> Group Time Budget</TabsTrigger>
            </TabsList>
          </div>

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
                          <BlockedWebsiteForm blockedWebsiteProp={blockedWebsite} callback={refreshBlockedWebsitesList} />
                        </DialogDescription>
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>

            </div>

            <div className="rounded-xl bg-muted/50 px-5 py-4" >
              <BlockedWebsitesTable blockedWebsites={blockedWebsitesList} deleteBlockedWebsite={(websiteName: string) => { setWebsiteToDelete(websiteName); setDeleteDialogOpen(true); }} editBlockedWebsite={editBlockedWebsite} />
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
          <TabsContent value="globalTimeBudget">
            <div className='mt-10 mb-5'>

              <div className='flex items-center justify-between text-3xl font-bold w-full text-muted-foreground'>
                <div className='flex items-center'>
                  Group Time Budget
                  <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild >
                        <button tabIndex={-1} className="flex items-center justify-center ml-2 rounded-full" >
                          <Info className="ml-3 mt-2 w-5 h-5 text-chart-5" />
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
                  <Button onClick={() => setIsEditGlobalTimeBudgetDialogOpen(true)}> <Pencil className='h-4 w-4 mr-2' /> Edit </Button>
                  <Button className="ml-4" onClick={() => setIsAddGlobalTimeBudgetWebsiteDialogOpen(true)}> <Plus className='h-5 w-5 mr-1' /> Add Website </Button>
                </div>

              </div>

              <div className='mt-8 flex items-center w-full'>
                <div className='flex items-center w-full'>
                  <Card className="">
                    <CardHeader className="p-5">
                      <CardTitle>Allowed Per Day</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 pt-0">
                      <div className='text-2xl font-medium text-muted-foreground'> {globalTimeBudget ? timeDisplayFormat(globalTimeBudget?.timeAllowed) : "00:00"} </div>
                    </CardContent>
                  </Card>

                  <Card className="ml-5">
                    <CardHeader className="p-5">
                      <CardTitle>Time Left Today</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 pt-0">
                      <div className='text-2xl font-medium text-muted-foreground'> {globalTimeBudget ? timeDisplayFormat(globalTimeBudget?.timeAllowed - globalTimeBudget?.totalTime) : "00:00"} </div>
                    </CardContent>
                  </Card>

                  <Card className="ml-5">
                    <CardHeader className="p-5">
                      <CardTitle>Redirect</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 pt-0">
                      <div className='text-2xl font-medium text-muted-foreground'> {globalTimeBudget ? (globalTimeBudget.redirectUrl == "" ? "Inspiration" : globalTimeBudget.redirectUrl) : "Inspiration"} </div>
                    </CardContent>
                  </Card>

                  <Card className="ml-5">
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
                    <CardContent className="p-5 pt-0">
                      <div className='text-2xl font-medium text-muted-foreground'>
                        {globalTimeBudget ? (globalTimeBudget.scheduledBlockRanges.length === 0 ? "None" : "") : ""}
                        {globalTimeBudget && globalTimeBudget.scheduledBlockRanges.map((range, index) => (
                          <div key={index}>
                            {scheduledBlockDisplay(range)}
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
              <GlobalTimeBudgetTable globalTimeBudgetWebsites={globalTimeBudget ? globalTimeBudget?.websites : null} deleteBlockedWebsite={(websiteName: string) => { setGlobalWebsiteToDelete(websiteName); setDeleteGlobalDialogOpen(true); }} />
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
        </Tabs>
      </div>

      <footer className="bg-muted rounded-t-lg py-5 px-8 mt-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center text-muted-foreground font-semibold">Grounded Momentum <Activity className='w-4 h-4 mx-2' /> 2025 </div>
          <div className="flex items-center text-muted-foreground font-semibold">
            Join the
            <div className='flex items-center'>
              <Button className="ml-3 rounded-lg" onClick={() => { window.open("https://discord.gg/JJMZQ4r2", "_blank") }}>  <img height="20" width="20" className="mx-1 color-white" src="https://cdn.simpleicons.org/discord/5c4523" /> Discord </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Options;
