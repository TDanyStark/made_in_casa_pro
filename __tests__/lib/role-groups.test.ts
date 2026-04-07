import { UserRole } from '@/lib/definitions';
import {
  ADMIN_ONLY_ROLES,
  DIRECTIVO_SCOPE_ROLES,
  LEADERSHIP_ROLES,
  OPERATIONS_ROLES,
  PROJECT_EDIT_ROLES,
  PROJECT_VIEW_ROLES,
  hasAnyRole,
} from '@/lib/role-groups';

describe('role-groups', () => {
  it('preserves the current project view access matrix', () => {
    expect(PROJECT_VIEW_ROLES).toEqual([
      UserRole.ADMIN,
      UserRole.DIRECTIVO,
      UserRole.FINANCIERO,
      UserRole.COMERCIAL,
      UserRole.COLABORADOR,
    ]);
  });

  it('reuses operations roles for project editing', () => {
    expect(PROJECT_EDIT_ROLES).toBe(OPERATIONS_ROLES);
    expect(PROJECT_EDIT_ROLES).toEqual([
      UserRole.ADMIN,
      UserRole.DIRECTIVO,
      UserRole.FINANCIERO,
      UserRole.COMERCIAL,
    ]);
  });

  it('gives financiero the same directivo-scope permissions', () => {
    expect(DIRECTIVO_SCOPE_ROLES).toEqual([UserRole.DIRECTIVO, UserRole.FINANCIERO]);
    expect(ADMIN_ONLY_ROLES).toEqual([UserRole.ADMIN]);
    expect(LEADERSHIP_ROLES).toEqual([UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.FINANCIERO]);
  });

  it('hasAnyRole matches membership against readonly role groups', () => {
    expect(hasAnyRole(UserRole.ADMIN, PROJECT_EDIT_ROLES)).toBe(true);
    expect(hasAnyRole(UserRole.FINANCIERO, PROJECT_EDIT_ROLES)).toBe(true);
    expect(hasAnyRole(UserRole.COLABORADOR, PROJECT_EDIT_ROLES)).toBe(false);
  });
});
