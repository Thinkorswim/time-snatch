import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Check,
  Crown,
  RefreshCw,
  Mail,
  ExternalLink,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { User } from "@/models/User.ts";
import {
  signUpRequest,
  signInRequest,
  getUserData,
  loadUserFromStorage,
  saveUserToStorage,
  forgotPasswordRequest,
  resendVerificationEmailRequest,
  signOutRequest,
  signInWithGoogle,
  triggerSyncForProUser,
} from "@/lib/auth";
import {
  paymentPageRedirect,
} from "@/lib/payments";
import { hasApiPermission, requestApiPermission } from "@/lib/permissions";

type Browser = "chrome" | "firefox" | "edge";

const detectBrowser = (): Browser => {
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "edge";
  if (ua.includes("Firefox")) return "firefox";
  return "chrome";
};

const STORE_URLS = {
  cadence: {
    chrome:
      "https://chromewebstore.google.com/detail/cadence-pomodoro-focus-ti/mjpanfloecbdhkpilhgkglonabikjadf",
    firefox:
      "https://addons.mozilla.org/en-US/firefox/addon/cadence-pomodoro-focus-timers/",
    edge: "https://microsoftedge.microsoft.com/addons/detail/cadence-pomodoro-focus-/lkgpghlmfjbmfjckgebegoclmklkhdml",
  },
  gramControl: {
    chrome:
      "https://chromewebstore.google.com/detail/gramcontrol-%E2%80%93-block-insta/opfbphbmpekblencogampchiepebfmnm",
    firefox:
      "https://addons.mozilla.org/en-US/firefox/addon/block-instagram-distractions/",
    edge: "https://microsoftedge.microsoft.com/addons/detail/gramcontrol-%E2%80%93-block-insta/mgmeddnpmecnhicccmpedjpcpgokfpbc",
  },
} as const;

export function GMPlus() {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const browser = detectBrowser();
  const cdUrl = STORE_URLS.cadence[browser];
  const gcUrl = STORE_URLS.gramControl[browser];
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [user, setUser] = useState<User>(new User());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isLoadingUserData, setIsLoadingUserData] = useState<boolean>(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isForgotPassword, setIsForgotPassword] = useState<boolean>(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState<string>("");
  const [isForgotPasswordLoading, setIsForgotPasswordLoading] =
    useState<boolean>(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] =
    useState<string>("");
  const [hasBackendPermission, setHasBackendPermission] =
    useState<boolean>(false);
  const [showPermissionDialog, setShowPermissionDialog] =
    useState<boolean>(false);

  const handlePayment = async () => {
    setIsPaymentLoading(true);
    setError("");

    try {
      await paymentPageRedirect(user.authToken);
    } catch (error) {
      setError("Failed to redirect to payment page");
    }

    setIsPaymentLoading(false);
  };

  const handleSignOut = () => {
    signOutRequest(user.authToken);
    setUser(new User());
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  const refreshUserData = async () => {
    if (!user.email) return;

    try {
      setIsLoadingUserData(true);
      const freshUserData = await getUserData(user.authToken);

      if (freshUserData && freshUserData.data) {
        const updatedUser = new User(
          freshUserData.data.email,
          freshUserData.data.emailVerified || false,
          user.authToken,
          freshUserData.data.extensionsPlus || false
        );
        setUser(updatedUser);
        saveUserToStorage(updatedUser);
      } else {
        handleSignOut();
      }
    } catch (err) {
      console.error("Error refreshing user data:", err);
    } finally {
      setIsLoadingUserData(false);
    }
  };

  const handleResendVerification = async () => {
    setError("");
    setIsLoading(true);

    if (!user.email) {
      setError("No email address found. Please sign in again.");
      return;
    }

    try {
      await resendVerificationEmailRequest(user.email);
    } catch (error) {
      setError("Failed to resend verification email");
    }

    setIsLoading(false);
  };

  const ensurePermission = async (): Promise<boolean> => {
    if (hasBackendPermission) return true;
    setShowPermissionDialog(true);
    const granted = await requestApiPermission();
    setShowPermissionDialog(false);
    if (granted) setHasBackendPermission(true);
    return granted;
  };

  const handleAuthSubmit = async () => {
    if (!await ensurePermission()) return;
    setError("");
    setIsLoading(true);

    if (!email || !password) {
      setError("Email and password are required");
      setIsLoading(false);
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    let data;
    try {
      if (!isLogin) {
        data = await signUpRequest(email, password);
      } else {
        data = await signInRequest(email, password);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
      setIsLoading(false);
      return;
    }

    const newUser = new User(
      email,
      data.user?.emailVerified || false,
      data.user?.authToken || "",
      data.user?.extensionsPlus || false
    );

    setUser(newUser);
    saveUserToStorage(newUser);

    if (isLogin) {
      triggerSyncForProUser(newUser.authToken, newUser.extensionsPlus);
    }

    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    if (!await ensurePermission()) return;
    setError("");
    setIsLoading(true);

    try {
      const data = await signInWithGoogle();

      if (!data.user) {
        throw new Error("Invalid response from Google sign-in");
      }

      const newUser = new User(
        data.user.email,
        data.user.emailVerified || false,
        data.user.authToken || "",
        data.user.extensionsPlus || false
      );

      setUser(newUser);
      saveUserToStorage(newUser);

      triggerSyncForProUser(newUser.authToken, newUser.extensionsPlus);
    } catch (err: any) {
      setError(err.message || "Google sign-in failed");
    }

    setIsLoading(false);
  };

  const handleForgotPassword = async () => {
    setError("");
    setForgotPasswordMessage("");
    setIsForgotPasswordLoading(true);

    if (!forgotPasswordEmail) {
      setError("Email is required");
      setIsForgotPasswordLoading(false);
      return;
    }

    try {
      const response = await forgotPasswordRequest(forgotPasswordEmail);
      setForgotPasswordMessage(
        response.message ||
          "Password reset email sent successfully! Please check your inbox."
      );
    } catch (error) {
      setError("Failed to send password reset email");
    }

    setIsForgotPasswordLoading(false);
  };

  const handleBackToLogin = () => {
    setIsForgotPassword(false);
    setForgotPasswordEmail("");
    setForgotPasswordMessage("");
    setError("");
  };

  const checkBackendPermission = async () => {
    const hasPermission = await hasApiPermission();
    setHasBackendPermission(hasPermission);
  };

  useEffect(() => {
    const loadUserData = async () => {
      setIsInitialLoading(true);
      const loadedUser = await loadUserFromStorage();

      if (loadedUser) {
        setUser(loadedUser);
      }
      setIsInitialLoading(false);
    };

    loadUserData();
  }, []);

  useEffect(() => {
    checkBackendPermission();
  }, []);

  return (
    <>
      <div className="flex items-center justify-between mb-5 mt-10">
        <div className="text-3xl font-bold text-muted-foreground">
          Grounded Momentum
        </div>
      </div>

      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="sm:max-w-md p-8">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl mb-2">Permission Required</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              To sign in or create an account, we need permission to connect to
              our servers. This is required for authentication and sync features.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <div className="border border-border rounded-xl bg-background ">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Section */}
          <div className="space-y-6 p-8">
            {user.extensionsPlus ? (
              /* Active Plus view */
              <>
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">GM Extensions Plus Active</h3>
                    <p className="text-sm text-muted-foreground">
                      Thank you for your support!
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Your Extensions
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-primary/30 bg-primary/5">
                      <div className="flex items-center space-x-3">
                        <img src="/icon/128.png" className="w-8 h-8 rounded-md" />
                        <div>
                          <p className="text-sm font-medium">Time Snatch</p>
                          <p className="text-xs text-muted-foreground">
                            Block distracting websites
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                        Current
                      </span>
                    </div>

                    <a
                      href={cdUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/30 transition-colors group no-underline"
                    >
                      <div className="flex items-center space-x-3">
                        <img src="/icon/cd-128.png" className="w-8 h-8 rounded-md" />
                        <div>
                          <p className="text-sm font-medium">Cadence</p>
                          <p className="text-xs text-muted-foreground">
                            Pomodoro focus timers
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground transition-colors" />
                    </a>

                    <a
                      href={gcUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/30 transition-colors group no-underline"
                    >
                      <div className="flex items-center space-x-3">
                        <img src="/icon/gc-128.png" className="w-8 h-8 rounded-md" />
                        <div>
                          <p className="text-sm font-medium">GramControl</p>
                          <p className="text-xs text-muted-foreground">
                            Block Instagram distractions
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground transition-colors" />
                    </a>
                  </div>
                </div>
              </>
            ) : (
              /* Sales view */
              <>
                {/* Header */}
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary rounded-lg">
                    <Sparkles className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Unlock GM Extensions Plus</h3>
                    <p className="text-sm text-muted-foreground">
                      One subscription, all of our extensions
                    </p>
                  </div>
                </div>

                {/* Benefits with checkmarks */}
                <div className="space-y-3">
                  {[
                    "Cloud data backup",
                    "Cross-device & cross-browser sync",
                    "Access to all current and future plus features",
                    "Support open-source development",
                  ].map((text) => (
                    <div key={text} className="flex items-center space-x-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                        <Check className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <span className="text-sm text-muted-foreground">{text}</span>
                    </div>
                  ))}
                </div>

                {/* Extensions Included */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    3 Extensions Included
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-primary/30 bg-primary/5">
                      <div className="flex items-center space-x-3">
                        <img src="/icon/128.png" className="w-8 h-8 rounded" />
                        <div>
                          <p className="text-sm font-medium">Time Snatch</p>
                          <p className="text-xs text-muted-foreground">
                            Block distracting websites
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                        Current
                      </span>
                    </div>

                    <a
                      href={cdUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/30 transition-colors group no-underline"
                    >
                      <div className="flex items-center space-x-3">
                        <img src="/icon/cd-128.png" className="w-8 h-8 rounded" />
                        <div>
                          <p className="text-sm font-medium">Cadence</p>
                          <p className="text-xs text-muted-foreground">
                            Pomodoro focus timers
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground transition-colors" />
                    </a>

                    <a
                      href={gcUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/30 transition-colors group no-underline"
                    >
                      <div className="flex items-center space-x-3">
                        <img src="/icon/gc-128.png" className="w-8 h-8 rounded" />
                        <div>
                          <p className="text-sm font-medium">GramControl</p>
                          <p className="text-xs text-muted-foreground">
                            Block Instagram distractions
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground transition-colors" />
                    </a>
                  </div>
                </div>
              </>
            )}

            {/* Pricing Section - only shown when not Plus */}
            {!user.extensionsPlus && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium">Lifetime access</h4>

              <div className="p-6 border border-border rounded-lg bg-muted/30">
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    $19.99
                    <span className="text-lg font-normal text-muted-foreground ml-1">
                      one-time
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pay once, use forever
                  </p>

                  {/* Only show upgrade button if logged in */}
                  {user.email ? (
                    user.emailVerified ? (
                      <div>
                        <Button
                          className="w-full mt-4"
                          size="lg"
                          onClick={handlePayment}
                          disabled={isPaymentLoading}
                        >
                          {isPaymentLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Opening checkout...
                            </>
                          ) : (
                            <>
                              <Crown className="w-4 h-4 mr-2" />
                              Get Lifetime Access
                            </>
                          )}
                        </Button>
                        {error && !isLoading && (
                          <div className="mt-3 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                            {error}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 space-y-2">
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="flex items-center justify-center text-muted-foreground">
                            <Mail className="w-4 h-4 mr-2" />
                            <span className="text-sm font-medium">
                              Email verification required
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground text-center mt-1">
                            Please verify your email to upgrade to Plus
                          </p>
                        </div>
                      </div>
                    )
                  ) : isInitialLoading ? (
                    <div className="mt-4 p-3 bg-muted/50 border border-border rounded-lg">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
                        <p className="text-xs text-muted-foreground">
                          Loading...
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            )}

          </div>

          {/* Right Section - Login/Register Forms */}
          <div className="h-full flex items-center justify-center bg-muted/50 rounded-xl ">
            <div className="p-6 px-16 space-y-4 w-full max-w-md">
              {user.email ? (
                // Logged in view
                <div className="text-center space-y-4">
                  {isLoadingUserData ? (
                    <div className="p-4 border border-border rounded-lg">
                      <RefreshCw className="w-8 h-8 text-muted-foreground mx-auto mb-2 animate-spin" />
                      <p className="text-sm text-muted-foreground">
                        Updating user data...
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className={`p-4  rounded-lg bg-background `}>
                        <div className="flex items-center justify-center">
                          {!user.emailVerified && (
                            <Mail className="w-8 h-8 text-muted-foreground" />
                          )}
                        </div>
                        <h4
                          className={`font-semibold text-muted-foreground ${
                            user.emailVerified ? " text-base" : "text-lg "
                          }`}
                        >
                          {user.emailVerified
                            ? user.email
                            : "Please verify your email"}
                        </h4>
                        <div
                          className={`text-sm flex items-center justify-center ${
                            user.emailVerified
                              ? "text-green-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {user.extensionsPlus && (
                            <span className="mt-2 ml-2 px-1 w-16 text-center py-1 flex items-center justify-center text-xs bg-gradient-to-r from-chart-1 to-chart-2 text-white rounded-full font-semibold">
                              <Sparkles className="inline-block w-3 h-3 mr-1" />
                              Plus
                            </span>
                          )}
                        </div>
                        {!user.emailVerified && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Check your inbox for a verification email
                          </p>
                        )}
                      </div>

                      {!user.emailVerified && (
                        <Button
                          variant="outline"
                          className="w-full hover:bg-primary/20"
                          onClick={handleResendVerification}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Resend verification email
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full hover:bg-primary/20"
                        onClick={refreshUserData}
                        disabled={isLoadingUserData}
                      >
                        <RefreshCw
                          className={`w-4 h-4 mr-2 ${
                            isLoadingUserData ? "animate-spin" : ""
                          }`}
                        />
                        Refresh status
                      </Button>
                    </>
                  )}

                  <Button
                    variant="outline"
                    className="w-full hover:bg-primary/20"
                    onClick={handleSignOut}
                  >
                    Sign Out
                  </Button>
                </div>
              ) : isInitialLoading ? (
                // Initial loading state
                <div className="flex flex-col items-center justify-center space-y-3 py-8">
                  <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : (
                // Login/Register/Forgot Password forms
                <>
                  {isForgotPassword ? (
                    // Forgot Password form
                    <>
                      <div className="text-center mb-4">
                        <p className="text-sm text-muted-foreground">
                          Enter your email to reset your password
                        </p>
                      </div>

                      <div className="space-y-4">
                        {forgotPasswordMessage == "" && (
                          <div className="space-y-2">
                            <Label htmlFor="forgotEmail">Email</Label>
                            <Input
                              id="forgotEmail"
                              type="email"
                              placeholder="Enter your email"
                              value={forgotPasswordEmail}
                              onChange={(e) =>
                                setForgotPasswordEmail(e.target.value)
                              }
                              disabled={isForgotPasswordLoading}
                            />
                          </div>
                        )}

                        {error && (
                          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                            {error}
                          </div>
                        )}

                        {forgotPasswordMessage && (
                          <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
                            {forgotPasswordMessage}
                          </div>
                        )}

                        {forgotPasswordMessage == "" && (
                          <Button
                            className="w-full"
                            size="lg"
                            onClick={handleForgotPassword}
                            disabled={isForgotPasswordLoading}
                          >
                            {isForgotPasswordLoading ? (
                              <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                Sending Reset Email...
                              </>
                            ) : (
                              "Send Reset Email"
                            )}
                          </Button>
                        )}

                        <div className="text-center">
                          <Button
                            variant="link"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={handleBackToLogin}
                          >
                            Back to Login
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    // Login/Register form
                    <>
                      <div className="text-center mb-4">
                        <p className="text-sm text-muted-foreground">
                          Sign in or create an account to continue
                        </p>
                      </div>

                      <div className="flex items-center justify-center space-x-2 bg-background border border-border rounded-lg p-1">
                        <Button
                          variant={isLogin ? "default" : "ghost"}
                          size="sm"
                          onClick={() => {
                            setIsLogin(true);
                            setError("");
                          }}
                          className={`flex-1 ${isLogin ? "" : "hover:bg-primary/20"}`}
                        >
                          Login
                        </Button>
                        <Button
                          variant={!isLogin ? "default" : "ghost"}
                          size="sm"
                          onClick={() => {
                            setIsLogin(false);
                            setError("");
                          }}
                          className={`flex-1 ${!isLogin ? "" : "hover:bg-primary/20"}`}
                        >
                          Register
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="password">Password</Label>
                          <Input
                            id="password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>

                        {!isLogin && (
                          <div className="space-y-2">
                            <Label htmlFor="confirmPassword">
                              Confirm Password
                            </Label>
                            <Input
                              id="confirmPassword"
                              type="password"
                              placeholder="Confirm your password"
                              value={confirmPassword}
                              onChange={(e) =>
                                setConfirmPassword(e.target.value)
                              }
                              disabled={isLoading}
                            />
                          </div>
                        )}

                        {error && (
                          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                            {error}
                          </div>
                        )}

                        <Button
                          className="w-full"
                          size="lg"
                          onClick={handleAuthSubmit}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              {isLogin
                                ? "Signing In..."
                                : "Creating Account..."}
                            </>
                          ) : isLogin ? (
                            "Sign In"
                          ) : (
                            "Create Account"
                          )}
                        </Button>

                        <div className="relative">
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-muted/50 px-2 text-muted-foreground">
                              Or continue with
                            </span>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          className="w-full hover:bg-primary/20"
                          size="lg"
                          onClick={handleGoogleSignIn}
                          disabled={isLoading}
                        >
                          <svg
                            className="w-5 h-5 mr-2"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              fill="#4285F4"
                            />
                            <path
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              fill="#34A853"
                            />
                            <path
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                              fill="#FBBC05"
                            />
                            <path
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                              fill="#EA4335"
                            />
                          </svg>
                          Sign in with Google
                        </Button>

                        {isLogin && (
                          <div className="text-center">
                            <Button
                              variant="link"
                              size="sm"
                              className="text-muted-foreground"
                              onClick={() => setIsForgotPassword(true)}
                            >
                              Forgot password?
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
