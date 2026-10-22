// S11, S12: working minutes of a month (Monday to Friday, minus Colombian holidays).
import {
  DEFAULT_WEEKLY_WORK_HOURS,
  dailyWorkMinutes,
  monthWorkingDays,
  monthWorkingMinutes,
  parseWeeklyWorkHours,
} from '@/lib/work-time';

describe('work time', () => {
  it('splits 42 weekly hours into 504 minutes per day', () => {
    expect(dailyWorkMinutes(42)).toBe(504);
  });

  it('February 2026 has 20 working days -> 10080 minutes', () => {
    expect(monthWorkingDays(2026, 2)).toBe(20);
    expect(monthWorkingMinutes(2026, 2, 42)).toBe(10080);
  });

  it('March 2026 has 21 working days (Mar 23 holiday) -> 10584 minutes', () => {
    expect(monthWorkingDays(2026, 3)).toBe(21);
    expect(monthWorkingMinutes(2026, 3, 42)).toBe(10584);
  });

  it('rounds the daily minutes for decimal weekly hours', () => {
    // 40.5 h -> 2430 min / 5 = 486 min per day
    expect(monthWorkingMinutes(2026, 2, 40.5)).toBe(20 * 486);
  });

  it('defaults the weekly hours to 42 when the setting is missing or invalid', () => {
    expect(DEFAULT_WEEKLY_WORK_HOURS).toBe(42);
    expect(parseWeeklyWorkHours(null)).toBe(42);
    expect(parseWeeklyWorkHours(undefined)).toBe(42);
    expect(parseWeeklyWorkHours('abc')).toBe(42);
    expect(parseWeeklyWorkHours('0')).toBe(42);
    expect(parseWeeklyWorkHours('47.5')).toBe(47.5);
  });
});
