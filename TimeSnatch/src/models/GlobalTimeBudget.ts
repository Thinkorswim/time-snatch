export class GlobalTimeBudget {
  public totalTime: number;

  constructor(
    public websites: Set<string>,
    public timeAllowed: { [key: string]: number },
    public blockIncognito: boolean,
    public variableSchedule: boolean = false,
    public redirectUrl: string,
    public lastAccessedDate: string = new Date().toLocaleDateString('en-CA').slice(0, 10),
    public scheduledBlockRanges: Array<{ start: number; end: number, days: boolean[] }> = []
  ) {
    this.totalTime = 0;
  }

  // Serialize instance to plain object
  toJSON(): {
    websites: string[];
    timeAllowed: { [key: string]: number };
    totalTime: number;
    blockIncognito: boolean;
    variableSchedule: boolean;
    redirectUrl: string;
    lastAccessedDate: string;
    scheduledBlockRanges: Array<{ start: number; end: number, days: boolean[] }>;
  } {
    return {
      websites: Array.from(this.websites), 
      timeAllowed: this.timeAllowed,
      totalTime: this.totalTime,
      blockIncognito: this.blockIncognito, 
      variableSchedule: this.variableSchedule,
      redirectUrl: this.redirectUrl,
      lastAccessedDate: this.lastAccessedDate,
      scheduledBlockRanges: this.scheduledBlockRanges,
    };
  }

  // Deserialize plain object to class instance
  static fromJSON(json: {
    websites: string[];
    timeAllowed: { [key: string]: number };
    totalTime: number;
    blockIncognito: boolean;
    variableSchedule: boolean;
    redirectUrl: string;
    lastAccessedDate?: string; 
    scheduledBlockRanges: Array<{ start: number; end: number, days: boolean[] }>;
  }): GlobalTimeBudget {
    const instance = new GlobalTimeBudget(
      new Set(json.websites),
      json.timeAllowed,
      json.blockIncognito,
      json.variableSchedule,
      json.redirectUrl,
      json.lastAccessedDate ?? new Date().toLocaleDateString('en-CA').slice(0, 10), // Default to today if missing
      json.scheduledBlockRanges
    );
    instance.totalTime = json.totalTime; // Restore totalTime
    return instance;
  }
}