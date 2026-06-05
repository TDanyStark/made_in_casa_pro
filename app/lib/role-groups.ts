import { UserRole } from "./definitions";

export const ADMIN_ONLY_ROLES: readonly UserRole[] = [UserRole.ADMIN];

export const DIRECTIVO_SCOPE_ROLES: readonly UserRole[] = [
  UserRole.DIRECTIVO,
  UserRole.FINANCIERO,
];

export const LEADERSHIP_ROLES: readonly UserRole[] = [
  ...ADMIN_ONLY_ROLES,
  ...DIRECTIVO_SCOPE_ROLES,
];

export const AUTHENTICATED_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.DIRECTIVO,
  UserRole.COMERCIAL,
  UserRole.COLABORADOR,
  UserRole.FINANCIERO,
];

export const OPERATIONS_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  ...DIRECTIVO_SCOPE_ROLES,
  UserRole.COMERCIAL,
];

export const PROJECT_EDIT_ROLES: readonly UserRole[] = OPERATIONS_ROLES;

export const PROJECT_VIEW_ROLES: readonly UserRole[] = [
  ...PROJECT_EDIT_ROLES,
  UserRole.COLABORADOR,
];

export const CREATOR_FILTER_ROLES: readonly UserRole[] = OPERATIONS_ROLES;

// Roles que pueden ver quién creó cada proyecto en la lista de proyectos.
export const PROJECT_CREATOR_VIEW_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.DIRECTIVO,
];

export const TASK_OVERRIDE_ROLES: readonly UserRole[] = [
  ...LEADERSHIP_ROLES,
  UserRole.COMERCIAL,
];

export function hasAnyRole(userRole: UserRole, allowedRoles: readonly UserRole[]) {
  return allowedRoles.includes(userRole);
}

export function isDirectivoScopeRole(userRole: UserRole) {
  return DIRECTIVO_SCOPE_ROLES.includes(userRole);
}
