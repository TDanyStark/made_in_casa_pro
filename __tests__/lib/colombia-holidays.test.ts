// S12: Colombian public holidays are not working days.
import { colombiaHolidays, isColombiaHoliday } from '@/lib/colombia-holidays';

describe('colombiaHolidays()', () => {
  it('matches the official 2026 list (fixed, Ley Emiliani and Easter-based dates)', () => {
    expect(colombiaHolidays(2026)).toEqual([
      '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03',
      '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29',
      '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02',
      '2026-11-16', '2026-12-08', '2026-12-25',
    ]);
  });

  it('keeps an Emiliani holiday that already falls on Monday and moves the others', () => {
    // 2025: Jan 6 is Monday (stays); Mar 19 is Wednesday -> Mar 24; Easter Apr 20.
    const h2025 = colombiaHolidays(2025);
    expect(h2025).toContain('2025-01-06');
    expect(h2025).toContain('2025-03-24');
    expect(h2025).toContain('2025-04-17');
    expect(h2025).toContain('2025-04-18');
    // Sagrado Corazón and San Pedro y San Pablo both fall on Monday Jun 30, 2025:
    // one non-working day, listed once.
    expect(h2025).toContain('2025-06-30');
    expect(h2025).toHaveLength(17);
  });
});

describe('isColombiaHoliday()', () => {
  it('answers by calendar date', () => {
    expect(isColombiaHoliday(2026, 3, 23)).toBe(true);
    expect(isColombiaHoliday(2026, 3, 19)).toBe(false);
  });
});
