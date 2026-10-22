/**
 * Internal hourly rate from the monthly salary (odd/tasks/project-financials.md
 * S11, S13): rate = monthly salary / working minutes of the month × 60. Months
 * are evaluated in America/Bogota time.
 */
import { monthWorkingMinutes, parseWeeklyWorkHours } from "./work-time";

type Numeric = number | string | null | undefined;

export interface CompletionFreeze {
  completion_hourly_rate: number | null;
  completion_monthly_salary: number | null;
  completion_month_minutes: number | null;
}

const NO_FREEZE: CompletionFreeze = {
  completion_hourly_rate: null,
  completion_monthly_salary: null,
  completion_month_minutes: null,
};

const positive = (value: Numeric): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Hourly rate rounded to cents; null without a positive salary or minutes. */
export function hourlyRateFromSalary(monthlySalary: Numeric, monthMinutes: number): number | null {
  const salary = positive(monthlySalary);
  if (salary === null || !(monthMinutes > 0)) return null;
  return Math.round((salary / monthMinutes) * 60 * 100) / 100;
}

const bogotaFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "numeric",
});

/** Calendar year and month (1-12) of the instant in America/Bogota. */
export function bogotaYearMonth(at: Date): { year: number; month: number } {
  const parts = bogotaFormat.formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month") };
}

/**
 * Values frozen on a task completed at `at`: only internal assignees
 * (is_internal = 1) with a positive salary get them; otherwise all null.
 */
export function completionFreeze(input: {
  is_internal: Numeric | boolean;
  monthly_salary: Numeric;
  weekly_work_hours: Numeric;
  at: Date;
}): CompletionFreeze {
  const salary = positive(input.monthly_salary);
  if (Number(input.is_internal) !== 1 || salary === null) return { ...NO_FREEZE };
  const { year, month } = bogotaYearMonth(input.at);
  const minutes = monthWorkingMinutes(year, month, parseWeeklyWorkHours(input.weekly_work_hours));
  const rate = hourlyRateFromSalary(salary, minutes);
  if (rate === null) return { ...NO_FREEZE };
  return { completion_hourly_rate: rate, completion_monthly_salary: salary, completion_month_minutes: minutes };
}

/**
 * Rows read with the assignee's monthly salary and the weekly hours setting get
 * assignee_hourly_rate: the rate of unfinished internal work right now.
 */
export interface SalaryRateFields {
  assignee_monthly_salary: Numeric;
  weekly_work_hours: Numeric;
}

export function withCurrentHourlyRates<T extends SalaryRateFields>(
  rows: T[],
  now: Date = new Date()
): (T & { assignee_hourly_rate: number | null })[] {
  return rows.map((row) => ({
    ...row,
    assignee_hourly_rate: currentHourlyRate(row.assignee_monthly_salary, row.weekly_work_hours, now),
  }));
}

/** Rate of unfinished internal work: current salary over the current month. */
export function currentHourlyRate(monthlySalary: Numeric, weeklyWorkHours: Numeric, now: Date = new Date()): number | null {
  const { year, month } = bogotaYearMonth(now);
  return hourlyRateFromSalary(monthlySalary, monthWorkingMinutes(year, month, parseWeeklyWorkHours(weeklyWorkHours)));
}
