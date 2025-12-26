export class User {
  constructor(
    public email: string = "",
    public emailVerified: boolean = false,
    public authToken: string = "",
    public isPro: boolean = false,
    public nextBillingDate?: string,
    public billingCycle?: "monthly" | "yearly"
  ) {}

  toJSON(): {
    email: string;
    emailVerified: boolean;
    authToken: string;
    isPro: boolean;
    nextBillingDate?: string;
    billingCycle?: "monthly" | "yearly";
  } {
    return {
      email: this.email,
      emailVerified: this.emailVerified,
      authToken: this.authToken,
      isPro: this.isPro,
      nextBillingDate: this.nextBillingDate,
      billingCycle: this.billingCycle,
    };
  }

  static fromJSON(json: {
    email: string;
    emailVerified: boolean;
    authToken: string;
    isPro?: boolean; // Make optional for backward compatibility
    nextBillingDate?: string;
    billingCycle?: "monthly" | "yearly";
  }): User {
    return new User(
      json.email,
      json.emailVerified,
      json.authToken,
      json.isPro || false, // Default to false if not present
      json.nextBillingDate,
      json.billingCycle
    );
  }
}
