import { UserRole } from '@/lib/definitions';
import {
  ADMIN_ONLY_ROLES,
  DIRECTIVO_SCOPE_ROLES,
  LEADERSHIP_ROLES,
  OPERATIONS_ROLES,
  PROJECT_EDIT_ROLES,
  PROJECT_VIEW_ROLES,
  PROJECT_CREATOR_VIEW_ROLES,
  TASK_OVERRIDE_ROLES,
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

  it('lets comercial override task completion alongside leadership', () => {
    // COMERCIAL was added so comerciales can complete any task in their projects.
    expect(TASK_OVERRIDE_ROLES).toEqual([
      UserRole.ADMIN,
      UserRole.DIRECTIVO,
      UserRole.FINANCIERO,
      UserRole.COMERCIAL,
    ]);
    expect(hasAnyRole(UserRole.COMERCIAL, TASK_OVERRIDE_ROLES)).toBe(true);
    expect(hasAnyRole(UserRole.COLABORADOR, TASK_OVERRIDE_ROLES)).toBe(false);
  });

  it('restricts project creator visibility to admin and directivo', () => {
    expect(PROJECT_CREATOR_VIEW_ROLES).toEqual([UserRole.ADMIN, UserRole.DIRECTIVO]);
    expect(hasAnyRole(UserRole.ADMIN, PROJECT_CREATOR_VIEW_ROLES)).toBe(true);
    expect(hasAnyRole(UserRole.DIRECTIVO, PROJECT_CREATOR_VIEW_ROLES)).toBe(true);
    expect(hasAnyRole(UserRole.FINANCIERO, PROJECT_CREATOR_VIEW_ROLES)).toBe(false);
    expect(hasAnyRole(UserRole.COMERCIAL, PROJECT_CREATOR_VIEW_ROLES)).toBe(false);
  });
});
