export interface PaymentTokenResponse {
  token: string;
}

export interface PaymentManagementResponse {
  success: boolean;
  portal_data: {
    id: string;
    customer_id: string;
    urls: {
      general: {
        overview: string;
      };
      subscriptions: Array<{
        id: string;
        cancel_subscription: string;
        update_subscription_payment_method: string;
      }>;
    };
    created_at: string;
  };
}

export type BillingPeriod = "monthly" | "yearly";
export type Currency = "USD" | "EUR" | "GBP" | "INR" | "AUD" | "CAD";

export const detectCurrency = (): Currency => {
  const locale = navigator.language || "en-US";

  // Map locales to currencies
  const currencyMap: Record<string, Currency> = {
    "en-US": "USD",
    "en-GB": "GBP",
    "en-IN": "INR",
    "en-AU": "AUD",
    "en-CA": "CAD",
    "fr-FR": "EUR",
    "de-DE": "EUR",
    "es-ES": "EUR",
    "it-IT": "EUR",
    "pt-PT": "EUR",
    "nl-NL": "EUR",
    "hi-IN": "INR",
    "fr-CA": "CAD",
  };

  // Check for exact locale match first
  if (currencyMap[locale]) {
    return currencyMap[locale];
  }

  // Check for country code matches
  const countryCode = locale.split("-")[1];
  if (countryCode) {
    const countryToCurrency: Record<string, Currency> = {
      US: "USD",
      GB: "GBP",
      IN: "INR",
      AU: "AUD",
      CA: "CAD",
      // European countries
      FR: "EUR",
      DE: "EUR",
      ES: "EUR",
      IT: "EUR",
      PT: "EUR",
      NL: "EUR",
      BE: "EUR",
      AT: "EUR",
      FI: "EUR",
      IE: "EUR",
    };

    if (countryToCurrency[countryCode]) {
      return countryToCurrency[countryCode];
    }
  }

  // Default to EUR if no match found
  return "EUR";
};

export const getPriceId = (billingPeriod: BillingPeriod): string => {
  const priceIds: Record<BillingPeriod, string> = {
    monthly: "pri_01k95syjyp90rark44ajp2j8j6",
    yearly: "pri_01k95sxrnsnkb15m2pcrjamfgy",
  };

  return priceIds[billingPeriod];
};

export const createPaymentTokenRequest = async (
  authToken: string,
  billingPeriod: BillingPeriod,
  currency: Currency = detectCurrency()
): Promise<string> => {
  const priceId = getPriceId(billingPeriod);

  const response = await fetch(
    "https://api.groundedmomentum.com/api/payments/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        priceId,
        billingPeriod,
        currency, // Add currency to the request
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to create payment token");
  }

  const data: PaymentTokenResponse = await response.json();
  return data.token;
};

export const paymentPageRedirect = async (
  authToken: string,
  billingPeriod: BillingPeriod,
  currency: Currency = detectCurrency()
): Promise<void> => {
  try {
    // Step 1: Create payment token
    const paymentToken = await createPaymentTokenRequest(
      authToken,
      billingPeriod,
      currency
    );

    // Step 2: Redirect to payment page
    const paymentUrl = `https://groundedmomentum.com/payment?token=${encodeURIComponent(
      paymentToken
    )}`;
    window.open(paymentUrl, "_blank");
  } catch (error) {
    console.error("Payment processing failed:", error);
    throw error;
  }
};

export const getPaymentManagementLinks =
  async (authToken: string): Promise<PaymentManagementResponse | null> => {
    try {
      const response = await fetch(
        "https://api.groundedmomentum.com/api/payments/manage",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

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

export const getCurrencySymbol = (currency: Currency): string => {
  const symbols: Record<Currency, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    INR: "₹",
    AUD: "A$",
    CAD: "C$",
  };
  return symbols[currency];
};

export const getPricing = (
  billingPeriod: BillingPeriod,
  currency: Currency = detectCurrency()
) => {
  const currencySymbol = getCurrencySymbol(currency);

  // Explicit pricing for each currency and billing period
  const pricing: Record<Currency, Record<BillingPeriod, any>> = {
    USD: {
      monthly: {
        price: "4.99",
        period: "month",
        description: "$4.99 per month",
        priceId: "pri_01k95syjyp90rark44ajp2j8j6",
      },
      yearly: {
        price: "3.33",
        period: "month",
        description: "Billed $39.99 yearly",
        priceId: "pri_01k95sxrnsnkb15m2pcrjamfgy",
      },
    },
    EUR: {
      monthly: {
        price: "4.49",
        period: "month",
        description: "€4.49 per month",
        priceId: "pri_01k95syjyp90rark44ajp2j8j6",
      },
      yearly: {
        price: "3.00",
        period: "month",
        description: "Billed €35.99 yearly",
        priceId: "pri_01k95sxrnsnkb15m2pcrjamfgy",
      },
    },
    GBP: {
      monthly: {
        price: "3.99",
        period: "month",
        description: "£3.99 per month",
        priceId: "pri_01k95syjyp90rark44ajp2j8j6",
      },
      yearly: {
        price: "2.67",
        period: "month",
        description: "Billed £31.99 yearly",
        priceId: "pri_01k95sxrnsnkb15m2pcrjamfgy",
      },
    },
    INR: {
      monthly: {
        price: "399",
        period: "month",
        description: "₹399 per month",
        priceId: "pri_01k95syjyp90rark44ajp2j8j6",
      },
      yearly: {
        price: "267",
        period: "month",
        description: "Billed ₹3199 yearly",
        priceId: "pri_01k95sxrnsnkb15m2pcrjamfgy",
      },
    },
    AUD: {
      monthly: {
        price: "7.49",
        period: "month",
        description: "A$7.49 per month",
        priceId: "pri_01k95syjyp90rark44ajp2j8j6",
      },
      yearly: {
        price: "5.00",
        period: "month",
        description: "Billed A$59.99 yearly",
        priceId: "pri_01k95sxrnsnkb15m2pcrjamfgy",
      },
    },
    CAD: {
      monthly: {
        price: "6.49",
        period: "month",
        description: "C$6.49 per month",
        priceId: "pri_01k95syjyp90rark44ajp2j8j6",
      },
      yearly: {
        price: "4.33",
        period: "month",
        description: "Billed C$51.99 yearly",
        priceId: "pri_01k95sxrnsnkb15m2pcrjamfgy",
      },
    },
  };

  const result = pricing[currency][billingPeriod];
  return {
    ...result,
    currency,
    currencySymbol,
  };
};

export const formatBillingDate = (dateString?: string): string => {
  if (!dateString) return "Unknown";

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Invalid date";
  }
};
