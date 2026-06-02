const API_BASE = "https://api.groundedmomentum.com";

export type Plan = "monthly" | "yearly" | "lifetime";

// Plus product (pro_01k95stz5gfmmme6qcbrh0eqzd) price IDs.
export const PLANS: Record<Plan, { priceId: string; fallbackPrice: string }> = {
  monthly: { priceId: "pri_01k95syjyp90rark44ajp2j8j6", fallbackPrice: "$4.99" },
  yearly: { priceId: "pri_01k95sxrnsnkb15m2pcrjamfgy", fallbackPrice: "$29.99" },
  lifetime: { priceId: "pri_01ks8etrbav589r8sxfv2njqxm", fallbackPrice: "$79.99" },
};

export interface LocalizedPrices {
  currencyCode: string | null;
  monthly: string;
  yearly: string;
  lifetime: string;
}

export interface PaymentManagementResponse {
  success: boolean;
  hasSubscription: boolean;
  planType: Plan | null;
  portalUrl?: string | null;
  cancelUrl?: string | null;
  updatePaymentUrl?: string | null;
}

// Fetch localized prices from the backend (which proxies Paddle's
// pricing-preview API, geolocated by IP). Falls back to USD list prices.
export const fetchLocalizedPrices = async (): Promise<LocalizedPrices> => {
  const fallback: LocalizedPrices = {
    currencyCode: "USD",
    monthly: PLANS.monthly.fallbackPrice,
    yearly: PLANS.yearly.fallbackPrice,
    lifetime: PLANS.lifetime.fallbackPrice,
  };

  try {
    const response = await fetch(`${API_BASE}/api/payments/prices`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) return fallback;

    const data = await response.json();
    return {
      currencyCode: data.currencyCode ?? "USD",
      monthly: data.monthly?.formatted ?? fallback.monthly,
      yearly: data.yearly?.formatted ?? fallback.yearly,
      lifetime: data.lifetime?.formatted ?? fallback.lifetime,
    };
  } catch (error) {
    console.error("Error fetching localized prices:", error);
    return fallback;
  }
};

export const createPaymentTokenRequest = async (
  authToken: string,
  plan: Plan
): Promise<string> => {
  const response = await fetch(`${API_BASE}/api/payments/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ priceId: PLANS[plan].priceId }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to create payment token");
  }

  const data = await response.json();
  return data.token;
};

export const paymentPageRedirect = async (
  authToken: string,
  plan: Plan
): Promise<void> => {
  const paymentToken = await createPaymentTokenRequest(authToken, plan);
  const paymentUrl = `https://groundedmomentum.com/payment?token=${encodeURIComponent(paymentToken)}`;
  window.open(paymentUrl, "_blank");
};

// Fetch the Paddle customer-portal links so a subscriber can update payment
// details or cancel. Lifetime/free users get hasSubscription: false.
export const getPaymentManagementLinks = async (
  authToken: string
): Promise<PaymentManagementResponse | null> => {
  try {
    const response = await fetch(`${API_BASE}/api/payments/manage`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Authentication failed");
      }
      const errorData = await response.json();
      throw new Error(
        errorData.message || "Failed to get payment management links"
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching payment management links:", error);
    throw error;
  }
};
