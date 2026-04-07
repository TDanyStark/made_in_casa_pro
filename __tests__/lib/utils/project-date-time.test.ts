import {
  isSupportedProjectDateTime,
  normalizeOptionalProjectText,
  normalizeProjectDateTime,
} from '@/lib/utils/project-date-time';

describe('project date-time helpers', () => {
  it('normalizes datetime-local input with Bogota offset', () => {
    expect(normalizeProjectDateTime('2026-04-07T09:30')).toBe('2026-04-07T14:30:00.000Z');
  });

  it('normalizes offset-aware ISO input to UTC', () => {
    expect(normalizeProjectDateTime('2026-04-07T09:30:00-05:00')).toBe('2026-04-07T14:30:00.000Z');
  });

  it('detects supported project datetime formats', () => {
    expect(isSupportedProjectDateTime('2026-04-07T09:30')).toBe(true);
    expect(isSupportedProjectDateTime('2026-04-07T09:30:00Z')).toBe(true);
    expect(isSupportedProjectDateTime('2026/04/07 09:30')).toBe(false);
  });

  it('normalizes empty optional text to null', () => {
    expect(normalizeOptionalProjectText('   ')).toBeNull();
    expect(normalizeOptionalProjectText(' OC-123 ')).toBe('OC-123');
    expect(normalizeOptionalProjectText(undefined)).toBeUndefined();
  });
});
