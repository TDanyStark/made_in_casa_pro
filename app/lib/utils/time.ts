export interface DHM {
  days: number;
  hours: number;
  minutes: number;
}

/**
 * Converts days, hours and minutes to total minutes.
 * 1 day = 1440 minutes, 1 hour = 60 minutes.
 */
export function dhmToMinutes(dhm: Partial<DHM>): number {
  const { days = 0, hours = 0, minutes = 0 } = dhm;
  return (days * 1440) + (hours * 60) + minutes;
}

/**
 * Converts total minutes to a DHM object (days, hours, minutes).
 */
export function minutesToDHM(totalMinutes: number): DHM {
  if (!totalMinutes || totalMinutes < 0) return { days: 0, hours: 0, minutes: 0 };
  
  const days = Math.floor(totalMinutes / 1440);
  const remainingAfterDays = totalMinutes % 1440;
  const hours = Math.floor(remainingAfterDays / 60);
  const minutes = remainingAfterDays % 60;
  
  return { days, hours, minutes };
}

/**
 * Formats DHM into a human readable string (e.g. "1d 2h 30m").
 */
export function formatDHM(totalMinutes: number | null | undefined): string {
  if (totalMinutes === null || totalMinutes === undefined || totalMinutes === 0) return "0m";
  
  const { days, hours, minutes } = minutesToDHM(totalMinutes);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.length > 0 ? parts.join(" ") : "0m";
}
