import { UserRole } from "@/lib/definitions";
import { buildCreatorFilterOptions } from "@/lib/utils/project-filters";

describe("buildCreatorFilterOptions()", () => {
  it("lists comerciales, then directivos, then admins, alphabetically within each group", () => {
    const options = buildCreatorFilterOptions([
      { id: 1, name: "Zoe Admin", rol_id: UserRole.ADMIN },
      { id: 2, name: "Bruno Directivo", rol_id: UserRole.DIRECTIVO },
      { id: 3, name: "Carla Comercial", rol_id: UserRole.COMERCIAL },
      { id: 4, name: "Ana Comercial", rol_id: UserRole.COMERCIAL },
      { id: 5, name: "Andrés Admin", rol_id: UserRole.ADMIN },
    ]);

    expect(options).toEqual([
      { value: "4", label: "Ana Comercial", group: "Comerciales" },
      { value: "3", label: "Carla Comercial", group: "Comerciales" },
      { value: "2", label: "Bruno Directivo", group: "Directivos" },
      { value: "5", label: "Andrés Admin", group: "Admins" },
      { value: "1", label: "Zoe Admin", group: "Admins" },
    ]);
  });

  it("leaves out roles that cannot create projects", () => {
    const options = buildCreatorFilterOptions([
      { id: 1, name: "Fina", rol_id: UserRole.FINANCIERO },
      { id: 2, name: "Colo", rol_id: UserRole.COLABORADOR },
      { id: 3, name: "Cami", rol_id: UserRole.COMERCIAL },
    ]);

    expect(options).toEqual([{ value: "3", label: "Cami", group: "Comerciales" }]);
  });

  it("leaves out inactive users", () => {
    const options = buildCreatorFilterOptions([
      { id: 1, name: "Activo", rol_id: UserRole.COMERCIAL, is_active: true },
      { id: 2, name: "Inactivo", rol_id: UserRole.COMERCIAL, is_active: false },
      { id: 3, name: "Directivo inactivo", rol_id: UserRole.DIRECTIVO, is_active: false },
    ]);

    expect(options).toEqual([{ value: "1", label: "Activo", group: "Comerciales" }]);
  });

  it("returns an empty list when there are no users", () => {
    expect(buildCreatorFilterOptions([])).toEqual([]);
  });
});
