// S10: an exact static route entry is authoritative before dynamic patterns.
jest.mock('@/lib/LinksData', () => ({
  links: [{ route: '/projects', roles: [1, 2, 3, 4, 5] }],
  linksNotVisible: [
    { route: '/projects/[id]', roles: [1, 2, 3, 4, 5] },
    { route: '/projects/create', roles: [1, 2, 3, 5] },
    { route: '/projects/[id]/edit', roles: [1, 2, 3, 5] },
  ],
}));

import { checkRoutePermission } from '@/lib/permissions';
import { UserRole } from '@/lib/definitions';

describe('checkRoutePermission() static vs dynamic', () => {
  it('denies /projects/create to a role only allowed by /projects/[id]', () => {
    expect(checkRoutePermission('/projects/create', UserRole.COLABORADOR)).toBe(false);
  });

  it('allows /projects/create to a role listed on the static entry', () => {
    expect(checkRoutePermission('/projects/create', UserRole.COMERCIAL)).toBe(true);
  });

  it('keeps matching dynamic project ids for the dynamic entry roles', () => {
    expect(checkRoutePermission('/projects/15', UserRole.COLABORADOR)).toBe(true);
  });

  it('keeps denying a nested dynamic route to roles not listed on it', () => {
    expect(checkRoutePermission('/projects/15/edit', UserRole.COLABORADOR)).toBe(false);
  });
});
