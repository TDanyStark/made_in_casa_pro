import { cn, formatDate } from '@/lib/utils';

describe('cn()', () => {
  it('returns an empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns a single class name unchanged', () => {
    expect(cn('text-red-500')).toBe('text-red-500');
  });

  it('merges multiple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('ignores falsy values', () => {
    expect(cn('foo', undefined, null, false, '', 'bar')).toBe('foo bar');
  });

  it('resolves tailwind padding conflicts — keeps last value', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('resolves conflicting text colors — keeps last value', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles object inputs with boolean values', () => {
    expect(cn({ 'font-bold': true, 'italic': false })).toBe('font-bold');
  });

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('handles conditional arrays', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });
});

describe('formatDate()', () => {
  it('returns "No disponible" for null', () => {
    expect(formatDate(null)).toBe('No disponible');
  });

  it('returns "No disponible" for undefined', () => {
    expect(formatDate(undefined)).toBe('No disponible');
  });

  it('returns "No disponible" for empty string', () => {
    expect(formatDate('')).toBe('No disponible');
  });

  it('returns a formatted string for a valid UTC ISO string', () => {
    // 2024-01-15T12:00:00.000Z → after -5h → 2024-01-15T07:00:00Z
    const result = formatDate('2024-01-15T12:00:00.000Z');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('subtracts exactly 5 hours from the stored UTC timestamp', () => {
    // Input: 2024-03-10T15:00:00.000Z (3:00 PM UTC)
    // After -5h JS subtraction: 2024-03-10T10:00:00.000Z (10 AM UTC)
    // Rendered in America/Bogota (UTC-5): 2024-03-10T05:00:00 = March 10 at 5 AM
    const result = formatDate('2024-03-10T15:00:00.000Z');
    expect(result).toContain('10');
    expect(result).toContain('marzo');
    expect(result).toContain('2024');
  });

  it('accepts a Date object and formats it correctly', () => {
    const date = new Date('2024-06-01T10:00:00.000Z');
    const result = formatDate(date);
    expect(typeof result).toBe('string');
    expect(result).not.toBe('No disponible');
  });

  it('uses Spanish locale output by default', () => {
    const result = formatDate('2024-01-20T12:00:00.000Z');
    // Spanish months: enero, febrero, marzo...
    expect(result).toMatch(/enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/);
  });

  it('accepts custom Intl.DateTimeFormatOptions', () => {
    const result = formatDate('2024-01-15T12:00:00.000Z', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    expect(result).not.toBe('No disponible');
    expect(typeof result).toBe('string');
  });

  it('handles date string without timezone (treated as local)', () => {
    const result = formatDate('2024-12-25T00:00:00.000Z');
    expect(result).not.toBe('No disponible');
  });
});
