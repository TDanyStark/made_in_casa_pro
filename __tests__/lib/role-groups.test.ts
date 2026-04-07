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
      UserRole.COMERCIAL,
      UserRole.DIRECTIVO,
      UserRole.COLABORADOR,
    ]);
  });

  it('reuses operations roles for project editing', () => {
    expect(PROJECT_EDIT_ROLES).toBe(OPERATIONS_ROLES);
    expect(PROJECT_EDIT_ROLES).toEqual([
      UserRole.ADMIN,
      UserRole.COMERCIAL,
      UserRole.DIRECTIVO,
    ]);
  });

  it('keeps directivo-only scope separate for later financial parity rollout', () => {
    expect(DIRECTIVO_SCOPE_ROLES).toEqual([UserRole.DIRECTIVO]);
    expect(ADMIN_ONLY_ROLES).toEqual([UserRole.ADMIN]);
    expect(LEADERSHIP_ROLES).toEqual([UserRole.ADMIN, UserRole.DIRECTIVO]);
  });

  it('hasAnyRole matches membership against readonly role groups', () => {
    expect(hasAnyRole(UserRole.ADMIN, PROJECT_EDIT_ROLES)).toBe(true);
    expect(hasAnyRole(UserRole.COLABORADOR, PROJECT_EDIT_ROLES)).toBe(false);
  });
});
