export class BlockedWebsite {
  public totalTime: number;

  constructor(
    public website: string,
    public timeAllowed: number,
    public blockIncognito: boolean,
    public redirectUrl: string,
    public lastAccessedDate: string = new Date().toLocaleDateString('en-CA').slice(0, 10),
    public scheduledBlockRanges: Array<{ start: number; end: number }> = []
  ) {
    this.totalTime = 0; // Initialize default value
  }

  // Serialize instance to plain object
  toJSON(): {
    website: string;
    timeAllowed: number;
    totalTime: number;
    blockIncognito: boolean;
    redirectUrl: string;
    lastAccessedDate: string;
    scheduledBlockRanges: Array<{ start: number; end: number }>;
  } {
    return {
      website: this.website,
      timeAllowed: this.timeAllowed,
      totalTime: this.totalTime,
      blockIncognito: this.blockIncognito,
      redirectUrl: this.redirectUrl,
      lastAccessedDate: this.lastAccessedDate,
      scheduledBlockRanges: this.scheduledBlockRanges,
    };
  }

  // Deserialize plain object to class instance
  static fromJSON(json: {
    website: string;
    timeAllowed: number;
    totalTime: number;
    blockIncognito: boolean;
    redirectUrl: string;
    lastAccessedDate: string;
    scheduledBlockRanges: Array<{ start: number; end: number }>;
  }): BlockedWebsite {
    const instance = new BlockedWebsite(
      json.website,
      json.timeAllowed,
      json.blockIncognito,
      json.redirectUrl,
      json.lastAccessedDate,
      json.scheduledBlockRanges
    );
    instance.totalTime = json.totalTime; // Manually set totalTime
    return instance;
  }
}