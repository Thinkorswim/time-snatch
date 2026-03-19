export class User {
  constructor(
    public email: string = "",
    public emailVerified: boolean = false,
    public authToken: string = "",
    public extensionsPlus: boolean = false,
  ) {}

  toJSON(): {
    email: string;
    emailVerified: boolean;
    authToken: string;
    extensionsPlus: boolean;
  } {
    return {
      email: this.email,
      emailVerified: this.emailVerified,
      authToken: this.authToken,
      extensionsPlus: this.extensionsPlus,
    };
  }

  static fromJSON(json: {
    email: string;
    emailVerified: boolean;
    authToken: string;
    extensionsPlus?: boolean;
  }): User {
    return new User(
      json.email,
      json.emailVerified,
      json.authToken,
      json.extensionsPlus || false,
    );
  }
}
