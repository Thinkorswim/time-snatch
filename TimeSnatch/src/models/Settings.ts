export class Settings {
  constructor(
    public password: string = "",
    public whiteListPathsEnabled: boolean = false
  ) {}

  toJSON(): { password: string; whiteListPathsEnabled: boolean } {
    return {
      password: this.password,
      whiteListPathsEnabled: this.whiteListPathsEnabled,
    };
  }

  static fromJSON(json: { password: string; whiteListPathsEnabled: boolean }): Settings {
    return new Settings(json.password, json.whiteListPathsEnabled);
  }
}
