import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const validateURL = (url: string) => {
  try {
    // Add `http://` if the protocol is missing
    const normalizedUrl = url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `https://${url}`;

    const parsedUrl = new URL(normalizedUrl);

    return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(parsedUrl.hostname);
  } catch (error) {
    return false;
  }
};

export const extractHighLevelDomain = (url: string): string | null => {
  try {
    const normalizedUrl = url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `https://${url}`;

    const { hostname } = new URL(normalizedUrl); // Extract the hostname

    // Remove the 'www.' prefix if it exists
    const domain = hostname.startsWith('www.') ? hostname.slice(4) : hostname;

    const parts = domain.split('.');
    if (parts.length > 2) {
      // Remove subdomains, keeping only the domain and extension
      return parts.slice(-2).join('.');
    }

    return domain;
  } catch (error) {
    return null;
  }
};

export const extractHostnameAndDomain = (url: string): string | null => {
  try {
    const normalizedUrl = url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `https://${url}`;

    const { hostname } = new URL(normalizedUrl); // Extract the hostname

    const domain = hostname.startsWith('www.') ? hostname.slice(4) : hostname;

    return domain;
  } catch (error) {
    return null;
  }
};

export const hasSubdomain = (url: string | null): boolean => {
  if (!url) return false; // Return false if the URL is null

  try {
    const normalizedUrl = url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `https://${url}`;

    const { hostname } = new URL(normalizedUrl); // Extract the hostname

    // Remove the 'www.' prefix if it exists
    const domain = hostname.startsWith('www.') ? hostname.slice(4) : hostname;

    const parts = domain.split('.');

    // Ensure there are more than two parts and each part is non-empty
    if (parts.length > 2 && parts.every(part => part.length > 0)) {
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
};

export function convertSecondsToHoursMinutes(seconds: number): { hours: number; minutes: number } {
  if (seconds < 0) return { hours: 0, minutes: 0 };

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return { hours, minutes };
}

export function convertSecondsToHoursMinutesSeconds(seconds: number): { hours: number; minutes: number; seconds: number } {
  if (seconds < 0) return { hours: 0, minutes: 0, seconds: 0 };

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return { hours, minutes, seconds: remainingSeconds };
}

export function convertMinutesToMinutesHours(minutes: number): { hours: number; minutes: number } {
  if (minutes < 0) return { hours: 0, minutes: 0 };

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return { hours, minutes: remainingMinutes };
}

export const timeDisplayFormatBadge = (time: number) => {
  const { hours, minutes, seconds } = convertSecondsToHoursMinutesSeconds(time)
  let timeString = ""

  if (hours > 0) {
    timeString += `${hours}:` + `${minutes}`.padStart(2, '0')
  } else {
    timeString += `${minutes}` + ":" + `${seconds}`.padStart(2, '0')
  }

  return timeString
}

export const timeDisplayFormat = (time: number, isVariable: boolean = false, isChart: boolean = false) => {
  if (!isChart) {
    if (isVariable) {
      if (time <= 0) {
        if (time == 0) return "Blocked"
        else return "Day Off"
      }
    } else {
      if (time <= 0) return "Blocked"
    }
  }

  const { hours, minutes, seconds } = convertSecondsToHoursMinutesSeconds(time)
  let timeString = ""


  if (hours > 0) {
    timeString += `${hours}:` + `${minutes}`.padStart(2, '0') + ":"
  } else {
    timeString += `${minutes}` + ":"
  }

  timeString += `${seconds}`.padStart(2, '0')

  return timeString
}

export const scheduledBlockDisplay = (range: { start: number, end: number }) => {

  const { hours: startHours, minutes: startMinutes } = convertMinutesToMinutesHours(range.start)
  const { hours: endHours, minutes: endMinutes } = convertMinutesToMinutesHours(range.end)

  return `${startHours}`.padStart(2, '0') + ":" + `${startMinutes}`.padStart(2, '0') + " - " + `${endHours}`.padStart(2, '0') + ":" + `${endMinutes}`.padStart(2, '0')
}

export function updateObjectKeyAndData<T>(
  obj: Record<string, T>,
  targetKey: string,
  newKey: string,
  newData: T
): Record<string, T> {
  const newObject: Record<string, T> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (key === targetKey) {
        // Replace the target key and data
        newObject[newKey] = newData;
      } else {
        // Copy other keys and values as is
        newObject[key] = obj[key];
      }
    }
  }

  return newObject;
}

export const encryptPassword = async (plainText: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const compareEncrypted = async (plainText: string, hashedValue: string) => {
  const possibleHash = await encryptPassword(plainText);
  return possibleHash === hashedValue;
};

export const numberToDay = (day: number) => {
  switch (day) {
    case 0:
      return "Monday";
    case 1:
      return "Tuesday";
    case 2:
      return "Wednesday";
    case 3:
      return "Thursday";
    case 4:
      return "Friday";
    case 5:
      return "Saturday";
    case 6:
      return "Sunday";
    default:
      return "";
  }
};