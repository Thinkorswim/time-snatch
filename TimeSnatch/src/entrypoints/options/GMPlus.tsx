import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Check,
  Crown,
  RefreshCw,
  Mail,
  CreditCard,
  XCircle,
  Calendar,
  Database,
  Heart,
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
  formatBillingDate,
  paymentPageRedirect,
  getPricing,
  getPaymentManagementLinks,
  detectCurrency,
  type BillingPeriod,
  type PaymentManagementResponse,
  type Currency,
} from "@/lib/payments";
import { hasApiPermission, requestApiPermission } from "@/lib/permissions";

export function GMPlus() {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("yearly");
  const [currency, setCurrency] = useState<Currency>(detectCurrency());
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [user, setUser] = useState<User>(new User());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isLoadingUserData, setIsLoadingUserData] = useState<boolean>(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState<boolean>(false);
  const [paymentManagementLinks, setPaymentManagementLinks] =
    useState<PaymentManagementResponse | null>(null);
  const [isLoadingManagementLinks, setIsLoadingManagementLinks] =
    useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isForgotPassword, setIsForgotPassword] = useState<boolean>(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState<string>("");
  const [isForgotPasswordLoading, setIsForgotPasswordLoading] =
    useState<boolean>(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] =
    useState<string>("");
  const [hasBackendPermission, setHasBackendPermission] =
    useState<boolean>(false);
  const [isCheckingPermission, setIsCheckingPermission] =
    useState<boolean>(true);
  const [isRequestingPermission, setIsRequestingPermission] =
    useState<boolean>(false);

  const handlePayment = async () => {
    setIsPaymentLoading(true);
    setError("");

    try {
      await paymentPageRedirect(user.authToken, billingPeriod);
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
          freshUserData.data.isPro || false,
          freshUserData.data.nextBillingDate,
          freshUserData.data.billingCycle
        );
        setUser(updatedUser);
        saveUserToStorage(updatedUser);

        if (updatedUser.isPro) {
          loadPaymentManagementLinks(user.authToken);
        }
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

  const loadPaymentManagementLinks = async (authToken: string) => {
    setIsLoadingManagementLinks(true);
    try {
      const links = await getPaymentManagementLinks(authToken);
      setPaymentManagementLinks(links);
    } catch (error) {
      console.log("Failed to load payment management links");
    }
    setIsLoadingManagementLinks(false);
  };

  const handleUpdatePaymentMethod = () => {
    if (
      paymentManagementLinks &&
      paymentManagementLinks.portal_data.urls.subscriptions.length > 0
    ) {
      const updateUrl =
        paymentManagementLinks.portal_data.urls.subscriptions[0]
          .update_subscription_payment_method;
      window.open(updateUrl, "_blank");
    }
  };

  const handleCancelSubscription = () => {
    if (
      paymentManagementLinks &&
      paymentManagementLinks.portal_data.urls.subscriptions.length > 0
    ) {
      const cancelUrl =
        paymentManagementLinks.portal_data.urls.subscriptions[0]
          .cancel_subscription;
      window.open(cancelUrl, "_blank");
    }
  };

  const handleAuthSubmit = async () => {
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
      data.user?.isPro || false,
      data.user?.nextBillingDate,
      data.user?.billingCycle
    );

    setUser(newUser);
    saveUserToStorage(newUser);

    // Trigger sync for Pro users after login (non-blocking)
    if (isLogin) {
      triggerSyncForProUser(newUser.authToken, newUser.isPro);
    }

    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
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
        data.user.isPro || false,
        data.user.nextBillingDate,
        data.user.billingCycle
      );

      setUser(newUser);
      saveUserToStorage(newUser);

      // Trigger sync for Pro users after login (non-blocking)
      triggerSyncForProUser(newUser.authToken, newUser.isPro);

      // Load payment management links for Pro users
      if (newUser.isPro) {
        loadPaymentManagementLinks(newUser.authToken);
      }
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
    setIsCheckingPermission(true);
    const hasPermission = await hasApiPermission();
    setHasBackendPermission(hasPermission);
    setIsCheckingPermission(false);
  };

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);

    const granted = await requestApiPermission();

    setError("");

    if (granted) {
      setHasBackendPermission(true);
    } else {
      setError(
        "Permission was denied. Backend functionality will not be available."
      );
    }

    setIsRequestingPermission(false);
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

    // Initialize user data and currency
    loadUserData();
    setCurrency(detectCurrency());
  }, []);

  useEffect(() => {
    if (user.isPro) {
      loadPaymentManagementLinks(user.authToken);
    }
  }, [user.isPro]);

  useEffect(() => {
    if (user.billingCycle) {
      setBillingPeriod(user.billingCycle as BillingPeriod);
    }
  }, [user.billingCycle]);

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

      {!hasBackendPermission && !isCheckingPermission && (
        <div className="mb-4 p-4 border border-primary-200 rounded-lg bg-yellow-50">
          <div className="flex justify-between items-center space-x-3">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-yellow-800 mb-1">
                Backend Permission Required
              </h4>
              <p className="text-sm text-yellow-700 mb-3">
                To use Plus features like account management and cross-device
                sync, we need permission to connect to our backend server
                (https://api.groundedmomentum.com/).
              </p>
            </div>
            <Button
              onClick={handleRequestPermission}
              disabled={isRequestingPermission}
              size="sm"
              className=""
            >
              {isRequestingPermission ? (
                <>
                  <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                  Requesting...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Grant Permission
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="border border-border rounded-xl bg-background ">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Section - Benefits and Pricing */}
          <div className="space-y-6 p-8">
            {/* Benefits Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary rounded-lg">
                  <Sparkles className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">
                  Unlock Grounded Momentum Plus
                </h3>
              </div>

              <div className="space-y-4 mt-5">
                <div className="flex items-center space-x-3">
                  <Database className="w-5 h-5 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm">
                    Store your data persistently
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <RefreshCw className="w-5 h-5 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm">
                    Cross-device + cross-browser syncing functionality
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <Crown className="w-5 h-5 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm">
                    Plus features for all Grounded Momentum products
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <Heart className="w-5 h-5 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm">
                    Support further open-source development 
                  </span>
                </div>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-medium">Choose your plan</h4>
                <div className="text-sm text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                  {currency}
                </div>
              </div>

              <div className="flex items-center space-x-4 mb-4">
                <Button
                  variant={billingPeriod === "monthly" ? "default" : "outline"}
                  onClick={() => setBillingPeriod("monthly")}
                  className={`flex-1 border-0 shadow-none ${
                    billingPeriod === "monthly"
                      ? "bg-primary"
                      : "bg-primary/20 hover:bg-primary/40"
                  }`}
                >
                  Monthly
                </Button>
                <Button
                  variant={billingPeriod === "yearly" ? "default" : "outline"}
                  onClick={() => setBillingPeriod("yearly")}
                  className={`flex-1 relative border-0 shadow-none ${
                    billingPeriod === "yearly"
                      ? "bg-primary"
                      : "bg-primary/20 hover:bg-primary/40"
                  }`}
                >
                  Yearly
                  <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                    Save 33%
                  </span>
                </Button>
              </div>

              <div className="p-6 border border-border rounded-lg bg-muted/30">
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    {getPricing(billingPeriod, currency).currencySymbol}
                    {getPricing(billingPeriod, currency).price}
                    <span className="text-lg font-normal text-muted-foreground">
                      /{getPricing(billingPeriod, currency).period}
                    </span>
                  </div>
                  {billingPeriod === "yearly" && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {getPricing(billingPeriod, currency).description}
                    </div>
                  )}

                  {/* Only show upgrade button if logged in */}
                  {user.email ? (
                    user.emailVerified ? (
                      <div>
                        {user.isPro ? (
                          <div className="mt-4 space-y-3">
                            <div className="p-3 bg-green-50 rounded-lg">
                              <div className="flex items-center justify-center text-green-700">
                                <Sparkles className="w-4 h-4 mr-2" />
                                <span className="font-medium">
                                  Active Plus Membership
                                </span>
                              </div>
                              <p className="text-xs text-green-600 text-center mt-1">
                                Thank you for your support!
                              </p>
                            </div>

                            {/* Billing Information */}
                            {(user.nextBillingDate || user.billingCycle) && (
                              <div className="p-3 bg-blue-50 rounded-lg">
                                <div className="flex items-center justify-center text-blue-700 mb-2">
                                  <Calendar className="w-4 h-4 mr-2" />
                                  <span className="font-medium">
                                    Billing Information
                                  </span>
                                </div>
                                <div className="space-y-1 text-xs text-blue-600 text-center">
                                  {user.billingCycle && (
                                    <p>
                                      Plan:{" "}
                                      <span className="font-medium capitalize">
                                        {user.billingCycle}
                                      </span>
                                    </p>
                                  )}
                                  {user.nextBillingDate && (
                                    <p>
                                      Next billing:{" "}
                                      <span className="font-medium">
                                        {formatBillingDate(
                                          user.nextBillingDate
                                        )}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {paymentManagementLinks && (
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="hover:bg-primary/50"
                                  onClick={handleUpdatePaymentMethod}
                                  disabled={isLoadingManagementLinks}
                                >
                                  <CreditCard className="w-4 h-4 mr-2" />
                                  Update Payment
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="hover:bg-primary/50"
                                  onClick={handleCancelSubscription}
                                  disabled={isLoadingManagementLinks}
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Cancel
                                </Button>
                              </div>
                            )}

                            {isLoadingManagementLinks && (
                              <div className="flex items-center justify-center text-sm text-muted-foreground">
                                <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                                Loading management options...
                              </div>
                            )}
                          </div>
                        ) : (
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
                                Upgrade to Plus
                              </>
                            )}
                          </Button>
                        )}
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
                  ) : (
                    <div className="mt-4 p-3 bg-muted/50 border border-dashed border-muted-foreground/30 rounded-lg">
                      <p className="text-sm text-muted-foreground text-center">
                        Sign in to upgrade to Plus
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Section - Login/Register Forms with better separation */}
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
                      <div className={`p-4  rounded-lg bg-primary/50 `}>
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
                          {/* {user.email} */}
                          {user.isPro && (
                            <span className="mt-2 ml-2 px-1 w-16 text-center py-1 flex items-center justify-center text-xs bg-gradient-to-r from-chart-1 to-chart-3 text-white rounded-full font-semibold">
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
                          className="w-full hover:bg-primary/50"
                          onClick={handleResendVerification}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Resend verification email
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full hover:bg-primary/50"
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
                    className="w-full hover:bg-primary/50"
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
                              disabled={
                                isForgotPasswordLoading || !hasBackendPermission
                              }
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
                            disabled={
                              isForgotPasswordLoading || !hasBackendPermission
                            }
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
                          {!hasBackendPermission
                            ? "Grant backend permission above to sign in or create an account"
                            : "Sign in or create an account to continue"}
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
                          className="flex-1"
                          disabled={!hasBackendPermission}
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
                          className="flex-1"
                          disabled={!hasBackendPermission}
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
                            disabled={isLoading || !hasBackendPermission}
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
                            disabled={isLoading || !hasBackendPermission}
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
                              disabled={isLoading || !hasBackendPermission}
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
                          disabled={isLoading || !hasBackendPermission}
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
                          className="w-full hover:bg-primary/50"
                          size="lg"
                          onClick={handleGoogleSignIn}
                          disabled={isLoading || !hasBackendPermission}
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
