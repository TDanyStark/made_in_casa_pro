export const INVALID_COP_AMOUNT_MESSAGE = "Ingresa un precio válido en pesos (solo números)";

/**
 * Parses a COP amount typed by a person. Pesos are integers, so "." and ","
 * are thousands separators ("1.500.000" -> 1500000, "1.500" -> 1500).
 * Returns null for an empty field and undefined when the input is not a number.
 */
export function parseCopAmount(input: string): number | null | undefined {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (!/^\$?[\d.,\s]+$/.test(trimmed)) return undefined;
  const digits = trimmed.replace(/\D/g, "");
  return digits === "" ? undefined : Number(digits);
}
