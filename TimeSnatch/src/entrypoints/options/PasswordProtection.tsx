import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { encryptPassword, compareEncrypted } from '@/lib/utils';
import { t, useLocale } from "@/lib/i18n";
import { syncSettingsBg } from '@/lib/sync';

const writeSettingsField = async (field: string, value: any): Promise<void> => {
  const result = (await browser.storage.local.get('settings')) as { settings?: Record<string, any> };
  const settings = { ...(result.settings ?? {}) };
  settings[field] = value;
  settings[`${field}UpdatedAt`] = new Date().toISOString();
  await browser.storage.local.set({ settings });
  syncSettingsBg();
};

export function PasswordProtection({
  requirePassword,
  setRequirePassword,
}: {
  requirePassword: boolean;
  setRequirePassword: (checked: boolean) => void;
}) {
  useLocale();
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
      await writeSettingsField('password', hashedPassword);
      setPasswordSaved(true);
      setIsPasswordSetDialogOpen(false);
      setErrorMsg("");
      setPassword("");
      setPasswordStep(1);
      setPasswordConfirm("");
    } else {
      setErrorMsg(t("password.passwordsMismatch"));
    }
  }

  const handleStep1 = () => {
    if (password.length > 0) {
      setPasswordStep(2);
    } else {
      setErrorMsg(t("password.passwordEmpty"));
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
    const data = (await browser.storage.local.get(['settings'])) as { settings?: { password?: string } };
    if (!data.settings?.password) return;

    const isCorrect = await compareEncrypted(passwordCheck, data.settings.password);
    if (isCorrect) {
      setRequirePassword(false);
      setIsPasswordEntryDialogOpen(false);
      setErrorMsg("");
      await writeSettingsField('password', "");
    } else {
      setErrorMsg(t("password.incorrect"));
    }
  }


  return (
    <>
      <div className="flex items-center justify-between max-w-[300px]">
        <div className="flex items-center">
          <Label className='text-base' htmlFor="requirePassword">{t('password.label')}</Label>
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button className="flex items-center justify-center ml-2 rounded-full">
                  <Info className="w-4 h-4 text-chart-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-primary text-foreground p-2 rounded">
                {t('password.tooltip')}
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
            <DialogTitle>{t('password.setTitle')}</DialogTitle>
            <DialogDescription>
              <div className="w-[99%] mx-auto">
                <div className="mt-5">
                  <div className="mt-5 flex items-center" >
                    <Label htmlFor={passwordStep === 1 ? 'password' : 'passwordConfirm'}>
                      {passwordStep === 1 ? t('password.password') : t('password.repeatPassword')}
                    </Label>
                    <TooltipProvider>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild >
                          <button tabIndex={-1} className="flex items-center justify-center ml-2 rounded-full" >
                            <Info className="w-4 h-4 text-chart-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-primary text-foreground p-2 rounded " >
                          {t('password.setTooltip1')} <br /> {t('password.setTooltip2')}
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
                        placeholder={t('password.placeholder')}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleStep1();
                          }
                        }}
                      />
                      <div className='w-full text-right mb-2'>
                        <Button className="mt-5" onClick={() => handleStep1() }> {t('password.next')} </Button>
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
                        placeholder={t('password.placeholder')}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handlePasswordSubmit();
                          }
                        }}
                        ref={confirmRef}
                      />
                      <div className='w-full text-right mb-2'>
                        <Button className="mt-5" onClick={() => setPasswordStep(1)}> {t('password.back')} </Button>
                        <Button className="ml-2 mt-5" onClick={() => handlePasswordSubmit()}> {t('password.confirm')} </Button>
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
            <DialogTitle>{t('password.disableTitle')}</DialogTitle>
            <DialogDescription>
              <div className="w-[99%] mx-auto">
                <div className="mt-5">
                  <div className="mt-5 flex items-center" >
                    <Label htmlFor="password">
                      {t('password.password')}
                    </Label>
                    <TooltipProvider>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild >
                          <button tabIndex={-1} className="flex items-center justify-center ml-2 rounded-full" >
                            <Info className="w-4 h-4 text-chart-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-primary text-foreground p-2 rounded " >
                          {t('password.disableTooltip1')} <br /> {t('password.disableTooltip2')}
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
                      placeholder={t('password.placeholder')}
                      onChange={(e) => setPasswordCheck(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handlePasswordCheck();
                        }
                      }}
                    />
                    <div className='w-full text-right mb-2'>
                      <Button className="mt-5" onClick={() => handlePasswordCheck()}> {t('password.disable')} </Button>
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