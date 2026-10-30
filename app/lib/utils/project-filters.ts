import { UserRole, type UserType } from "@/lib/definitions";
import { PROJECT_CREATOR_ROLES } from "@/lib/role-groups";
import type { SearchableSelectOption } from "@/components/ui/searchable-select";

const CREATOR_GROUP_LABELS: Partial<Record<UserRole, string>> = {
  [UserRole.COMERCIAL]: "Comerciales",
  [UserRole.DIRECTIVO]: "Directivos",
  [UserRole.ADMIN]: "Admins",
};

/**
 * Opciones del filtro "Creado por" de /projects: solo los roles que crean
 * proyectos y que estén activos, agrupados en el orden de PROJECT_CREATOR_ROLES
 * y por nombre dentro de cada grupo.
 */
export function buildCreatorFilterOptions(
  users: Pick<UserType, "id" | "name" | "rol_id" | "is_active">[]
): SearchableSelectOption[] {
  return PROJECT_CREATOR_ROLES.flatMap((role) =>
    users
      .filter((user) => user.rol_id === role && user.is_active !== false)
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .map((user) => ({
        value: String(user.id),
        label: user.name,
        group: CREATOR_GROUP_LABELS[role],
      }))
  );
}
