import { canAccessMyQuotes } from "@/lib/quotes-access";
import { UserRole } from "@/lib/definitions";

describe("canAccessMyQuotes", () => {
  it("allows external collaborators", () => {
    expect(canAccessMyQuotes(UserRole.COLABORADOR, false)).toBe(true);
  });

  it("denies internal collaborators", () => {
    expect(canAccessMyQuotes(UserRole.COLABORADOR, true)).toBe(false);
  });

  it.each([UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL, UserRole.FINANCIERO])(
    "denies non-collaborator role %i",
    (role) => {
      expect(canAccessMyQuotes(role, false)).toBe(false);
    },
  );
});
