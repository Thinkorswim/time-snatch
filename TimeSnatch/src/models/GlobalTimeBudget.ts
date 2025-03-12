export class GlobalTimeBudget {
  public totalTime: number;

  constructor(
    public websites: Set<string>,
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
    websites: string[];
    timeAllowed: number;
    totalTime: number;
    blockIncognito: boolean; // Ensure consistency with class property
    redirectUrl: string;
    lastAccessedDate: string;
    scheduledBlockRanges: Array<{ start: number; end: number }>;
  } {
    return {
      websites: Array.from(this.websites), // No need for `.map((w) => w)`
      timeAllowed: this.timeAllowed,
      totalTime: this.totalTime,
      blockIncognito: this.blockIncognito, // Ensure consistency
      redirectUrl: this.redirectUrl,
      lastAccessedDate: this.lastAccessedDate,
      scheduledBlockRanges: this.scheduledBlockRanges,
    };
  }

  // Deserialize plain object to class instance
  static fromJSON(json: {
    websites: string[];
    timeAllowed: number;
    totalTime: number;
    blockIncognito: boolean;
    redirectUrl: string;
    lastAccessedDate?: string; // Allow missing date (default to today)
    scheduledBlockRanges: Array<{ start: number; end: number }>;
  }): GlobalTimeBudget {
    const instance = new GlobalTimeBudget(
      new Set(json.websites),
      json.timeAllowed,
      json.blockIncognito,
      json.redirectUrl,
      json.lastAccessedDate ?? new Date().toLocaleDateString('en-CA').slice(0, 10), // Default to today if missing
      json.scheduledBlockRanges
    );
    instance.totalTime = json.totalTime; // Restore totalTime
    return instance;
  }
}