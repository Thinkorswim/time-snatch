import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { Settings } from '@/models/Settings';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { encryptPassword, compareEncrypted } from '@/lib/utils';
import { syncUpdateSettings } from '@/lib/sync';

export function PasswordProtection({
  requirePassword,
  setRequirePassword,
}: {
  requirePassword: boolean;
  setRequirePassword: (checked: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isPasswordSetDialogOpen, setIsPasswordSetDialogOpen] = useState(false);
  const [isPasswordEntryDialogOpen, setIsPasswordEntryDialogOpen] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordStep, setPasswordStep] = useState(1);
  const [errorMsg, setErrorMsg] = useState("");
  const [passwordCheck, setPasswordCheck] = useState("");
  const confirmRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (passwordStep === 2 && confirmRef.current) {
      confirmRef.current.focus();
    }
  }, [passwordStep]);

  const handleToggleRequirePassword = (checked: boolean) => {
    if (checked) {
      setIsPasswordSetDialogOpen(true);
      setRequirePassword(true);
    } else {
      setIsPasswordEntryDialogOpen(true);
    }
  };

  const handlePasswordSubmit = async () => {
    if (password === passwordConfirm) {
      const hashedPassword = await encryptPassword(password);
      browser.storage.local.get(['settings'], (data) => {
        const updatedSettings = { ...data.settings, password: hashedPassword };
        browser.storage.local.set({ settings: updatedSettings }, () => {
          // Sync to backend (fire-and-forget)
          syncUpdateSettings({ password: hashedPassword });
        });
      });
      setPasswordSaved(true);
      setIsPasswordSetDialogOpen(false);
      setErrorMsg("");
      setPassword("");
      setPasswordStep(1);
      setPasswordConfirm("");
    } else {
      setErrorMsg("Passwords do not match");
    }
  }

  const handleStep1 = () => {
    if (password.length > 0) {
      setPasswordStep(2);
    } else {
      setErrorMsg("Password cannot be empty");
    }
  }

  const handlePasswordSetDialogChange = (open: boolean) => {
    if (!open) {
      if (!passwordSaved) {
        setRequirePassword(false);
        setPasswordStep(1);
        setPassword("");
        setPasswordConfirm("");
        setErrorMsg("");
      }
    }

    setIsPasswordSetDialogOpen(open);
  }

  const handlePasswordEntryDialogChange = (open: boolean) => {
    if (!open) {
      setPasswordCheck("");
      setErrorMsg("");
    }

    setIsPasswordEntryDialogOpen(open);
  }

  const handlePasswordCheck = async () => {
    browser.storage.local.get(['settings'], async (data) => {
      if (data.settings.password) {
        const isCorrect = await compareEncrypted(passwordCheck, data.settings.password);
        if (isCorrect) {
          setRequirePassword(false);
          setIsPasswordEntryDialogOpen(false);
          setErrorMsg("");

          // Remove password from storage
          const updatedSettings = { ...data.settings, password: "" };
          browser.storage.local.set({ settings: updatedSettings }, () => {
            // Sync to backend (fire-and-forget)
            syncUpdateSettings({ password: "" });
          });
        } else {
          setErrorMsg("Incorrect password");
        }
      }
    });
  }


  return (
    <>
      <div className="flex items-center justify-between max-w-[300px]">
        <div className="flex items-center">
          <Label className='text-base' htmlFor="requirePassword">Password Protection</Label>
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button className="flex items-center justify-center ml-2 rounded-full">
                  <Info className="w-4 h-4 text-chart-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-primary text-foreground p-2 rounded">
                Prompt for a password before editing or removing blocked websites.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch
          id="requirePassword"
          className='data-[state=unchecked]:bg-background'
          checked={requirePassword}
          onCheckedChange={handleToggleRequirePassword}
        />
      </div>

      <Dialog open={isPasswordSetDialogOpen} onOpenChange={handlePasswordSetDialogChange} >
        <DialogContent className="bg-card" >
          <div className='bg-card m-2 p-4 rounded-md'>
            <DialogTitle>Password Protection</DialogTitle>
            <DialogDescription>
              <div className="w-[99%] mx-auto">
                <div className="mt-5">
                  <div className="mt-5 flex items-center" >
                    <Label htmlFor={passwordStep === 1 ? 'password' : 'passwordConfirm'}>
                      {passwordStep === 1 ? 'Password' : 'Repeat Password'}
                    </Label>
                    <TooltipProvider>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild >
                          <button tabIndex={-1} className="flex items-center justify-center ml-2 rounded-full" >
                            <Info className="w-4 h-4 text-chart-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-primary text-foreground p-2 rounded " >
                          You will not be able to recover this passsword if you forget or lose it. <br /> Let a trusted person input it or write it down.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {passwordStep === 1 && (
                    <>
                      <Input
                        className='mt-2'
                        type='password'
                        id="password"
                        value={password}
                        placeholder="Enter password"
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleStep1();
                          }
                        }}
                      />
                      <div className='w-full text-right mb-2'>
                        <Button className="mt-5" onClick={() => handleStep1() }> Next </Button>
                      </div>
                    </>
                  )}

                  {passwordStep === 2 && (
                    <>
                      <Input
                        className='mt-2'
                        type='password'
                        id="passwordConfirm"
                        value={passwordConfirm}
                        placeholder="Enter password"
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handlePasswordSubmit();
                          }
                        }}
                        ref={confirmRef}
                      />
                      <div className='w-full text-right mb-2'>
                        <Button className="mt-5" onClick={() => setPasswordStep(1)}> Back </Button>
                        <Button className="ml-2 mt-5" onClick={() => handlePasswordSubmit()}> Confirm </Button>
                      </div>
                    </>
                  )}

                  {errorMsg && <p className="text-red-500 text-sm mt-2"> {errorMsg} </p>}
                </div>
              </div >
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>


      <Dialog open={isPasswordEntryDialogOpen} onOpenChange={handlePasswordEntryDialogChange} >
        <DialogContent className="bg-card" >
          <div className='bg-card m-2 p-4 rounded-md'>
            <DialogTitle>Disable Password Protection</DialogTitle>
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
                          Enter the password to disable password protection. <br /> You need to delete the extension and reinstall it to reset the password.
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
    </>
  );
}