export class BlockedWebsite {
  public totalTime: number;

  constructor(
    public website: string,
    public timeAllowed: { [key: string]: number },
    public blockIncognito: boolean,
    public variableSchedule: boolean = false,
    public redirectUrl: string,
    public lastAccessedDate: string = new Date().toLocaleDateString('en-CA').slice(0, 10),
    public scheduledBlockRanges: Array<{ start: number; end: number, days: boolean[] }> = [],
    public allowedPaths: string[] = []
  ) {
    this.totalTime = 0; // Initialize default value
  }

  // Serialize instance to plain object
  toJSON(): {
    website: string;
    timeAllowed: {[key: string]: number};
    totalTime: number;
    blockIncognito: boolean;
    variableSchedule: boolean;
    redirectUrl: string;
    lastAccessedDate: string;
    scheduledBlockRanges: Array<{ start: number; end: number, days: boolean[] }>;
    allowedPaths: string[];
  } {
    return {
      website: this.website,
      timeAllowed: this.timeAllowed,
      totalTime: this.totalTime,
      blockIncognito: this.blockIncognito,
      variableSchedule: this.variableSchedule,
      redirectUrl: this.redirectUrl,
      lastAccessedDate: this.lastAccessedDate,
      scheduledBlockRanges: this.scheduledBlockRanges,
      allowedPaths: this.allowedPaths,
    };
  }

  // Deserialize plain object to class instance
  static fromJSON(json: {
    website: string;
    timeAllowed: {[key: string]: number};
    totalTime: number;
    blockIncognito: boolean;
    variableSchedule: boolean;
    redirectUrl: string;
    lastAccessedDate: string;
    scheduledBlockRanges: Array<{ start: number; end: number, days: boolean[] }>;
    allowedPaths: string[];
  }): BlockedWebsite {
    const instance = new BlockedWebsite(
      json.website,
      json.timeAllowed,
      json.blockIncognito,
      json.variableSchedule,
      json.redirectUrl,
      json.lastAccessedDate,
      json.scheduledBlockRanges,
      json.allowedPaths,
    );
    instance.totalTime = json.totalTime; // Manually set totalTime
    return instance;
  }
}