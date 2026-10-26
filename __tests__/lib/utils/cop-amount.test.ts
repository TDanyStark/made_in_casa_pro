import { parseCopAmount } from "@/lib/utils/cop-amount";

describe("parseCopAmount", () => {
  it.each([
    ["1.500.000", 1500000],
    ["1.500", 1500],
    ["$ 1.500.000", 1500000],
    ["1,500,000", 1500000],
    ["750000", 750000],
    ["0", 0],
  ])("parses thousands separators in %s", (input, expected) => {
    expect(parseCopAmount(input)).toBe(expected);
  });

  it.each([
    ["1500.5", 1500.5],
    ["1500.50", 1500.5],
    ["1.500.000,50", 1500000.5],
    ["1,500,000.25", 1500000.25],
  ])("keeps cents in %s instead of multiplying the amount", (input, expected) => {
    expect(parseCopAmount(input)).toBe(expected);
  });

  it("returns null for an empty field", () => {
    expect(parseCopAmount("  ")).toBeNull();
  });

  it.each(["abc", "-5", "1e5", "."])("rejects %s", (input) => {
    expect(parseCopAmount(input)).toBeUndefined();
  });
});
