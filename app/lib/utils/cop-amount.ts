export const INVALID_COP_AMOUNT_MESSAGE = "Ingresa un precio válido en pesos (solo números)";

/**
 * Parses a COP amount typed by a person.
 * "." and "," are thousands separators ("1.500.000" -> 1500000, "1.500" -> 1500),
 * except a last separator followed by one or two digits, which marks cents
 * ("1500.5" -> 1500.5, "1.500.000,50" -> 1500000.5).
 * Returns null for an empty field and undefined when the input is not a number.
 */
export function parseCopAmount(input: string): number | null | undefined {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (!/^\$?[\d.,\s]+$/.test(trimmed)) return undefined;

  const compact = trimmed.replace(/[$\s]/g, "");
  const centsMatch = compact.match(/^(.*\d)[.,](\d{1,2})$/);
  const integerPart = centsMatch ? centsMatch[1] : compact;
  const integerDigits = integerPart.replace(/[.,]/g, "");
  if (!/^\d+$/.test(integerDigits)) return undefined;

  return centsMatch ? Number(`${integerDigits}.${centsMatch[2]}`) : Number(integerDigits);
}
