// Uses the real LinksData route table (only the icon library is stubbed).
jest.mock("lucide-react", () => new Proxy({}, { get: () => () => null }));

import { checkRoutePermission } from "@/lib/permissions";
import { UserRole } from "@/lib/definitions";

describe("/projects/create permissions", () => {
  it.each([UserRole.COMERCIAL, UserRole.DIRECTIVO, UserRole.ADMIN])("allows role %s", (role) => {
    expect(checkRoutePermission("/projects/create", role)).toBe(true);
  });

  it.each([UserRole.FINANCIERO, UserRole.COLABORADOR])("denies role %s", (role) => {
    expect(checkRoutePermission("/projects/create", role)).toBe(false);
  });

  it("keeps financiero able to open the project edit page", () => {
    expect(checkRoutePermission("/projects/42/edit", UserRole.FINANCIERO)).toBe(true);
  });
});
