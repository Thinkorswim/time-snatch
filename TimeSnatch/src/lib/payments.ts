export type Currency = "USD" | "EUR" | "GBP" | "INR" | "AUD" | "CAD";

export const LIFETIME_PRICE_ID = "pri_01kkyq80fawwqybwy8thh0fs19";

export const detectCurrency = (): Currency => {
  const locale = navigator.language || "en-US";

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

  if (currencyMap[locale]) {
    return currencyMap[locale];
  }

  const countryCode = locale.split("-")[1];
  if (countryCode) {
    const countryToCurrency: Record<string, Currency> = {
      US: "USD",
      GB: "GBP",
      IN: "INR",
      AU: "AUD",
      CA: "CAD",
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

  return "EUR";
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

export const getLifetimePricing = (currency: Currency = detectCurrency()) => {
  const prices: Record<Currency, string> = {
    USD: "19.99",
    EUR: "18.99",
    GBP: "15.99",
    INR: "1,699",
    AUD: "29.99",
    CAD: "26.99",
  };

  return {
    price: prices[currency],
    currency,
    currencySymbol: getCurrencySymbol(currency),
    priceId: LIFETIME_PRICE_ID,
  };
};

export const createPaymentTokenRequest = async (
  authToken: string,
  currency: Currency = detectCurrency()
): Promise<string> => {
  const response = await fetch(
    "https://api.groundedmomentum.com/api/payments/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        priceId: LIFETIME_PRICE_ID,
        currency,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to create payment token");
  }

  const data = await response.json();
  return data.token;
};

export const paymentPageRedirect = async (
  authToken: string,
  currency: Currency = detectCurrency()
): Promise<void> => {
  const paymentToken = await createPaymentTokenRequest(authToken, currency);
  const paymentUrl = `https://groundedmomentum.com/payment?token=${encodeURIComponent(paymentToken)}`;
  window.open(paymentUrl, "_blank");
};
