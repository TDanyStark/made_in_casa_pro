/**
 * Working time of a month (odd/tasks/project-financials.md S11, S12): Monday to
 * Friday minus Colombian holidays; each day is the weekly legal hours / 5.
 */
import { isColombiaHoliday } from "./colombia-holidays";

export const DEFAULT_WEEKLY_WORK_HOURS = 42;
export const MAX_WEEKLY_WORK_HOURS = 60;
export const WEEKLY_HOURS_ERROR = `Las horas semanales deben ser un número mayor que 0 y máximo ${MAX_WEEKLY_WORK_HOURS}`;

/** Stored setting value -> weekly hours; missing or invalid values fall back to 42. */
export function parseWeeklyWorkHours(value: unknown): number {
  if (value === null || value === undefined || value === "") return DEFAULT_WEEKLY_WORK_HOURS;
  const hours = Number(value);
  return Number.isFinite(hours) && hours > 0 && hours <= MAX_WEEKLY_WORK_HOURS ? hours : DEFAULT_WEEKLY_WORK_HOURS;
}

/** Working minutes of one day: weekly minutes / 5, rounded (42 h -> 504 min). */
export function dailyWorkMinutes(weeklyHours: number): number {
  return Math.round((weeklyHours * 60) / 5);
}

/** Monday-to-Friday days of the month (1-12) that are not Colombian holidays. */
export function monthWorkingDays(year: number, month: number): number {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let days = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !isColombiaHoliday(year, month, day)) days++;
  }
  return days;
}

export function monthWorkingMinutes(year: number, month: number, weeklyHours: number): number {
  return monthWorkingDays(year, month) * dailyWorkMinutes(weeklyHours);
}
