import { UserRole } from "./definitions";

export const ADMIN_ONLY_ROLES: readonly UserRole[] = [UserRole.ADMIN];

export const DIRECTIVO_SCOPE_ROLES: readonly UserRole[] = [UserRole.DIRECTIVO];

export const LEADERSHIP_ROLES: readonly UserRole[] = [
  ...ADMIN_ONLY_ROLES,
  ...DIRECTIVO_SCOPE_ROLES,
];

export const OPERATIONS_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.COMERCIAL,
  UserRole.DIRECTIVO,
];

export const PROJECT_EDIT_ROLES: readonly UserRole[] = OPERATIONS_ROLES;

export const PROJECT_VIEW_ROLES: readonly UserRole[] = [
  ...PROJECT_EDIT_ROLES,
  UserRole.COLABORADOR,
];

export function hasAnyRole(userRole: UserRole, allowedRoles: readonly UserRole[]) {
  return allowedRoles.includes(userRole);
}
