export type PlanType = "monthly" | "yearly" | "lifetime";

export class User {
  constructor(
    public email: string = "",
    public emailVerified: boolean = false,
    public authToken: string = "",
    public extensionsPlus: boolean = false,
    public planType: PlanType | null = null,
  ) {}

  toJSON(): {
    email: string;
    emailVerified: boolean;
    authToken: string;
    extensionsPlus: boolean;
    planType: PlanType | null;
  } {
    return {
      email: this.email,
      emailVerified: this.emailVerified,
      authToken: this.authToken,
      extensionsPlus: this.extensionsPlus,
      planType: this.planType,
    };
  }

  static fromJSON(json: {
    email: string;
    emailVerified: boolean;
    authToken: string;
    extensionsPlus?: boolean;
    planType?: PlanType | null;
  }): User {
    return new User(
      json.email,
      json.emailVerified,
      json.authToken,
      json.extensionsPlus || false,
      json.planType ?? null,
    );
  }
}
