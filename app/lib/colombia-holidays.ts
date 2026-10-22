/**
 * Colombian public holidays by year (odd/tasks/project-financials.md S12).
 * Pure: fixed dates, Ley Emiliani dates moved to the following Monday, and
 * Easter-based dates. Dates are calendar days as "YYYY-MM-DD".
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const utcDate = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
const iso = (date: Date) => date.toISOString().slice(0, 10);

/** The same day when it is Monday, else the following Monday (Ley Emiliani). */
function nextMonday(date: Date): Date {
  const weekday = date.getUTCDay(); // 0 Sunday … 6 Saturday
  return weekday === 1 ? date : addDays(date, (8 - weekday) % 7);
}

/** Easter Sunday (Gregorian, anonymous algorithm). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

const FIXED: [number, number][] = [[1, 1], [5, 1], [7, 20], [8, 7], [12, 8], [12, 25]];
const EMILIANI: [number, number][] = [[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]];

/** Sorted, distinct holiday dates of the year ("YYYY-MM-DD"). */
export function colombiaHolidays(year: number): string[] {
  const easter = easterSunday(year);
  const dates = [
    ...FIXED.map(([m, d]) => utcDate(year, m, d)),
    ...EMILIANI.map(([m, d]) => nextMonday(utcDate(year, m, d))),
    addDays(easter, -3), // Jueves Santo
    addDays(easter, -2), // Viernes Santo
    addDays(easter, 43), // Ascensión (Monday after Easter + 39)
    addDays(easter, 64), // Corpus Christi (Monday after Easter + 60)
    addDays(easter, 71), // Sagrado Corazón (Monday after Easter + 68)
  ];
  return [...new Set(dates.map(iso))].sort();
}

const cache = new Map<number, Set<string>>();

/** Whether the calendar date (month 1-12) is a Colombian public holiday. */
export function isColombiaHoliday(year: number, month: number, day: number): boolean {
  let holidays = cache.get(year);
  if (!holidays) {
    holidays = new Set(colombiaHolidays(year));
    cache.set(year, holidays);
  }
  return holidays.has(iso(utcDate(year, month, day)));
}
