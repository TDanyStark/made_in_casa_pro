const LOCAL_DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const OFFSET_DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function ensureSeconds(value: string) {
  return value.length === 16 ? `${value}:00` : value;
}

export function isSupportedProjectDateTime(value: string) {
  return LOCAL_DATE_TIME_REGEX.test(value) || OFFSET_DATE_TIME_REGEX.test(value);
}

export function normalizeProjectDateTime(value: string) {
  const trimmedValue = value.trim();

  if (!isSupportedProjectDateTime(trimmedValue)) {
    throw new Error('Unsupported project date-time format');
  }

  const normalizedInput = LOCAL_DATE_TIME_REGEX.test(trimmedValue)
    ? `${ensureSeconds(trimmedValue)}-05:00`
    : trimmedValue;

  const date = new Date(normalizedInput);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid project date-time value');
  }

  return date.toISOString();
}

export function normalizeOptionalProjectText(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}
