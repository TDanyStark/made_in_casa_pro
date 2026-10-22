// S11, S13: internal rate from the monthly salary and the month's working minutes.
import {
  bogotaYearMonth,
  completionFreeze,
  currentHourlyRate,
  hourlyRateFromSalary,
} from '@/lib/internal-rate';

describe('hourlyRateFromSalary()', () => {
  it('is monthly salary / month minutes × 60, rounded to cents', () => {
    expect(hourlyRateFromSalary(5040000, 10080)).toBe(30000);
    expect(hourlyRateFromSalary(5040000, 10584)).toBe(28571.43);
    expect(hourlyRateFromSalary('5040000.00', 10080)).toBe(30000);
  });

  it('returns null without a positive salary', () => {
    expect(hourlyRateFromSalary(null, 10080)).toBeNull();
    expect(hourlyRateFromSalary(undefined, 10080)).toBeNull();
    expect(hourlyRateFromSalary(0, 10080)).toBeNull();
    expect(hourlyRateFromSalary(-5, 10080)).toBeNull();
  });
});

describe('bogotaYearMonth()', () => {
  it('evaluates the month in America/Bogota time', () => {
    // 2026-03-01 03:00 UTC is 2026-02-28 22:00 in Bogotá
    expect(bogotaYearMonth(new Date('2026-03-01T03:00:00Z'))).toEqual({ year: 2026, month: 2 });
    expect(bogotaYearMonth(new Date('2026-03-01T05:00:00Z'))).toEqual({ year: 2026, month: 3 });
  });
});

describe('completionFreeze()', () => {
  const feb = new Date('2026-02-15T15:00:00Z');

  it('freezes salary, month minutes and rate for an internal with salary', () => {
    expect(completionFreeze({ is_internal: 1, monthly_salary: '5040000.00', weekly_work_hours: 42, at: feb })).toEqual({
      completion_hourly_rate: 30000,
      completion_monthly_salary: 5040000,
      completion_month_minutes: 10080,
    });
  });

  it.each([
    ['internal without salary', { is_internal: 1, monthly_salary: null }],
    ['internal with salary 0', { is_internal: 1, monthly_salary: 0 }],
    ['external', { is_internal: 0, monthly_salary: 5040000 }],
    ['unknown internal flag', { is_internal: null, monthly_salary: 5040000 }],
  ])('leaves everything null for %s', (_label, input) => {
    expect(completionFreeze({ ...input, weekly_work_hours: 42, at: feb })).toEqual({
      completion_hourly_rate: null,
      completion_monthly_salary: null,
      completion_month_minutes: null,
    });
  });
});

describe('currentHourlyRate()', () => {
  it('uses the current month and weekly hours', () => {
    expect(currentHourlyRate(5040000, 42, new Date('2026-03-10T15:00:00Z'))).toBe(28571.43);
    expect(currentHourlyRate(null, 42, new Date('2026-03-10T15:00:00Z'))).toBeNull();
  });
});
