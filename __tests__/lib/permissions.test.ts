import { UserRole } from '@/lib/definitions';

// Mock LinksData to isolate from Lucide icon imports (ESM)
jest.mock('@/lib/LinksData', () => ({
  links: [
    { route: '/dashboard', roles: [1, 2, 3, 4] },
    { route: '/users', roles: [4] },
    { route: '/projects', roles: [1, 2, 4] },
    { route: '/clients', roles: [1, 2, 4] },
  ],
  linksNotVisible: [
    { route: '/clients/[id]', roles: [1, 2, 4] },
    { route: '/users/[id]', roles: [4] },
    { route: '/projects/[id]/edit', roles: [1, 2, 4] },
  ],
}));

// Import after mock setup
import { routePermissions, checkRoutePermission } from '@/lib/permissions';

describe('routePermissions', () => {
  it('is a record mapping route strings to role arrays', () => {
    expect(typeof routePermissions).toBe('object');
    expect(Array.isArray(routePermissions['/dashboard'])).toBe(true);
  });

  it('merges entries from both links and linksNotVisible', () => {
    expect(routePermissions['/dashboard']).toBeDefined();
    expect(routePermissions['/clients/[id]']).toBeDefined();
  });

  it('maps /dashboard to all roles', () => {
    expect(routePermissions['/dashboard']).toEqual(expect.arrayContaining([1, 2, 3, 4]));
  });

  it('maps /users to ADMIN role only', () => {
    expect(routePermissions['/users']).toEqual([4]);
  });
});

describe('checkRoutePermission()', () => {
  describe('exact route matching', () => {
    it('returns true when user role is in the allowed list for /dashboard', () => {
      expect(checkRoutePermission('/dashboard', UserRole.COLABORADOR)).toBe(true);
    });

    it('returns true when ADMIN accesses /users', () => {
      expect(checkRoutePermission('/users', UserRole.ADMIN)).toBe(true);
    });

    it('returns false when COMERCIAL tries to access /users', () => {
      expect(checkRoutePermission('/users', UserRole.COMERCIAL)).toBe(false);
    });

    it('returns false for a completely unknown route', () => {
      expect(checkRoutePermission('/unknown-route', UserRole.ADMIN)).toBe(false);
    });
  });

  describe('dynamic route matching', () => {
    it('returns true for /clients/123 matching /clients/[id] when role is allowed', () => {
      expect(checkRoutePermission('/clients/123', UserRole.ADMIN)).toBe(true);
    });

    it('returns true for /clients/abc (string id) matching /clients/[id]', () => {
      expect(checkRoutePermission('/clients/abc', UserRole.COMERCIAL)).toBe(true);
    });

    it('returns false for /users/5 when user is COMERCIAL (not in /users/[id] allowed roles)', () => {
      expect(checkRoutePermission('/users/5', UserRole.COMERCIAL)).toBe(false);
    });

    it('returns true for /users/5 when user is ADMIN', () => {
      expect(checkRoutePermission('/users/5', UserRole.ADMIN)).toBe(true);
    });

    it('handles nested dynamic routes like /projects/[id]/edit', () => {
      expect(checkRoutePermission('/projects/42/edit', UserRole.ADMIN)).toBe(true);
    });

    it('does NOT match /clients/123/extra (different segment count) to /clients/[id]', () => {
      expect(checkRoutePermission('/clients/123/extra', UserRole.ADMIN)).toBe(false);
    });
  });

  describe('role boundary tests', () => {
    it('ADMIN (4) can access /projects', () => {
      expect(checkRoutePermission('/projects', UserRole.ADMIN)).toBe(true);
    });

    it('COLABORADOR (3) cannot access /projects (not in allowed roles)', () => {
      expect(checkRoutePermission('/projects', UserRole.COLABORADOR)).toBe(false);
    });

    it('NO_AUTHENTICADO (0) is denied on all routes including /dashboard', () => {
      expect(checkRoutePermission('/dashboard', UserRole.NO_AUTHENTICADO)).toBe(false);
    });

    it('DIRECTIVO (2) can access /clients', () => {
      expect(checkRoutePermission('/clients', UserRole.DIRECTIVO)).toBe(true);
    });
  });
});
