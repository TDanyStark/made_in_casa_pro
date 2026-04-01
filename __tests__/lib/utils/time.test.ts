import { dhmToMinutes, minutesToDHM, formatDHM } from '@/lib/utils/time';

describe('Time Utilities', () => {
  describe('dhmToMinutes()', () => {
    it('converts days to minutes correctly (1d = 1440m)', () => {
      expect(dhmToMinutes({ days: 1 })).toBe(1440);
      expect(dhmToMinutes({ days: 2 })).toBe(2880);
    });

    it('converts hours to minutes correctly (1h = 60m)', () => {
      expect(dhmToMinutes({ hours: 1 })).toBe(60);
      expect(dhmToMinutes({ hours: 5 })).toBe(300);
    });

    it('converts minutes correctly', () => {
      expect(dhmToMinutes({ minutes: 1 })).toBe(1);
      expect(dhmToMinutes({ minutes: 30 })).toBe(30);
    });

    it('combines days, hours and minutes correctly', () => {
      // 1d 2h 30m = 1440 + 120 + 30 = 1590
      expect(dhmToMinutes({ days: 1, hours: 2, minutes: 30 })).toBe(1590);
    });

    it('handles empty input as 0', () => {
      expect(dhmToMinutes({})).toBe(0);
    });
  });

  describe('minutesToDHM()', () => {
    it('converts 1440m to 1d 0h 0m', () => {
      expect(minutesToDHM(1440)).toEqual({ days: 1, hours: 0, minutes: 0 });
    });

    it('converts 60m to 0d 1h 0m', () => {
      expect(minutesToDHM(60)).toEqual({ days: 0, hours: 1, minutes: 0 });
    });

    it('converts 30m to 0d 0h 30m', () => {
      expect(minutesToDHM(30)).toEqual({ days: 0, hours: 0, minutes: 30 });
    });

    it('converts 1590m to 1d 2h 30m', () => {
      expect(minutesToDHM(1590)).toEqual({ days: 1, hours: 2, minutes: 30 });
    });

    it('handles 0 or negative correctly', () => {
      expect(minutesToDHM(0)).toEqual({ days: 0, hours: 0, minutes: 0 });
      expect(minutesToDHM(-10)).toEqual({ days: 0, hours: 0, minutes: 0 });
    });
  });

  describe('formatDHM()', () => {
    it('formats 1590m as "1d 2h 30m"', () => {
      expect(formatDHM(1590)).toBe('1d 2h 30m');
    });

    it('omits zero parts', () => {
      expect(formatDHM(1440)).toBe('1d');
      expect(formatDHM(60)).toBe('1h');
      expect(formatDHM(30)).toBe('30m');
      expect(formatDHM(1500)).toBe('1d 1h');
    });

    it('returns "0m" for 0 or null', () => {
      expect(formatDHM(0)).toBe('0m');
      expect(formatDHM(null)).toBe('0m');
      expect(formatDHM(undefined)).toBe('0m');
    });
  });
});
