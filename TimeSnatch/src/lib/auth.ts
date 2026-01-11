import { User } from "../models/User.ts";
import { syncAll } from "@/lib/sync.ts";

const BASE_URL = "https://api.groundedmomentum.com";

export interface AuthResponse {
  user?: {
    email: string;
    emailVerified: boolean;
    authToken: string;
    isPro?: boolean;
    nextBillingDate?: string;
    billingCycle?: "monthly" | "yearly";
  };
  message?: string;
}

export interface UserData {
  data: {
    email: string;
    emailVerified: boolean;
    authToken: string;
    isPro: boolean;
    nextBillingDate?: string;
    billingCycle?: "monthly" | "yearly";
  };
}

// Generic API request helper
interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  authToken?: string;
  credentials?: RequestCredentials;
}

const apiRequest = async <T>(
  endpoint: string,
  options: ApiRequestOptions = {},
  errorMessage: string
): Promise<T> => {
  const { method = "POST", body, authToken } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || errorMessage);
  }

  return await response.json();
};

export const signUpRequest = (email: string, password: string): Promise<AuthResponse> =>
  apiRequest("/api/auth/sign-up/email", { body: { email, password } }, "Registration failed");

export const signInRequest = (email: string, password: string): Promise<AuthResponse> =>
  apiRequest("/api/auth/sign-in/email", { body: { email, password } }, "Login failed");

// Trigger sync for Pro users after login (non-blocking)
export const triggerSyncForProUser = (authToken: string, isPro: boolean): void => {
  if (isPro && authToken) {
    // Run sync in background, don't await
    syncAll(authToken).catch((err) => {
      console.error("Background sync failed:", err);
    });
  }
};

export const forgotPasswordRequest = (email: string): Promise<{ message: string }> =>
  apiRequest(
    "/api/auth/forget-password",
    { body: { email, redirectTo: BASE_URL } },
    "Failed to send password reset email"
  );

export const resendVerificationEmailRequest = (email: string): Promise<{ message: string }> =>
  apiRequest(
    "/api/auth/send-verification-email",
    { body: { email } },
    "Failed to send verification email"
  );

export const getUserData = async (authToken: string): Promise<UserData | null> => {
  try {
    return await apiRequest<UserData>(
      "/api/user",
      { method: "GET", authToken },
      "Failed to fetch user data"
    );
  } catch (err: any) {
    if (err.message === "Failed to fetch user data") {
      return null;
    }
    console.error("Error fetching user data:", err);
    return null;
  }
};

export const loadUserFromStorage = async (): Promise<User | null> => {
  try {
    const result = await browser.storage.local.get(["user"]);
    const savedUser = result.user;

    if (!savedUser) {
      return null;
    }

    const freshUserData = await getUserData(savedUser.authToken);

    if (freshUserData && freshUserData.data) {
      const updatedUserData = {
        email: freshUserData.data.email,
        emailVerified: freshUserData.data.emailVerified || false,
        authToken: savedUser.authToken,
        isPro: freshUserData.data.isPro || false,
        nextBillingDate: freshUserData.data.nextBillingDate,
        billingCycle: freshUserData.data.billingCycle,
      };
      const updatedUser = User.fromJSON(updatedUserData);
      saveUserToStorage(updatedUser);
      return updatedUser;
    } else {
      clearUserFromStorage();
      return null;
    }
  } catch (err) {
    console.error("Error loading user data:", err);
    clearUserFromStorage();
    return null;
  }
};

export const saveUserToStorage = (user: User): void => {
  browser.storage.local.set({ user: user.toJSON() });
};

export const clearUserFromStorage = (): void => {
  browser.storage.local.remove(["user"]);
};

export const signOutRequest = async (authToken: string): Promise<{ message: string }> => {
  try {
    clearUserFromStorage();
    return await apiRequest(
      "/api/auth/sign-out",
      { authToken, body: {} },
      "Sign out failed"
    );
  } catch (error) {
    clearUserFromStorage();
    console.error("Sign out error:", error);
    throw error;
  }
};

export const signInWithGoogle = async (): Promise<AuthResponse> => {
  try {
    const { url: authUrl, secureToken } = await apiRequest<{ url: string; secureToken: string }>(
      "/api/auth/sign-in/social",
      { body: { provider: "google", disableRedirect: true } },
      "Failed to initiate Google sign-in"
    );

    if (!secureToken) {
      throw new Error("No secureToken parameter found in auth URL");
    }

    // Open auth URL in a popup using browser.windows API
    const width = 500;
    const height = 600;

    const currentWindow = await browser.windows.getCurrent();
    const left = Math.round(
      (currentWindow.width || screen.width) / 2 -
        width / 2 +
        (currentWindow.left || 0)
    );
    const top = Math.round(
      (currentWindow.height || screen.height) / 2 -
        height / 2 +
        (currentWindow.top || 0)
    );

    const popupWindow = await browser.windows.create({
      url: authUrl,
      type: "popup",
      width,
      height,
      left,
      top,
    });

    if (!popupWindow?.id) {
      throw new Error("Failed to open popup window");
    }

    const windowId = popupWindow.id;

    await new Promise<void>((resolve) => {
      const checkUrl = async () => {
        try {
          const tabs = await browser.tabs.query({ windowId });
          if (tabs.length > 0 && tabs[0].url) {
            const currentUrl = tabs[0].url;
            if (
              currentUrl.startsWith("https://api.groundedmomentum.com") ||
              currentUrl.startsWith(BASE_URL)
            ) {
              clearInterval(intervalId);
              removeListener();
              await browser.windows.remove(windowId);
              resolve();
            }
          }
        } catch (error) {
          clearInterval(intervalId);
          removeListener();
          resolve();
        }
      };

      const intervalId = setInterval(checkUrl, 500);

      const removeListener = () => {
        browser.windows.onRemoved.removeListener(closedListener);
      };

      const closedListener = (closedWindowId: number) => {
        if (closedWindowId === windowId) {
          clearInterval(intervalId);
          removeListener();
          resolve();
        }
      };

      browser.windows.onRemoved.addListener(closedListener);
    });

    const backendResponse = await apiRequest<AuthResponse>(
      "/api/oauth/exchange-code",
      { body: { secureToken } },
      "Google sign-in failed"
    );

    return backendResponse;
  } catch (error: any) {
    console.error("Google sign-in error:", error);
    throw new Error("Google sign-in failed");
  }
};
