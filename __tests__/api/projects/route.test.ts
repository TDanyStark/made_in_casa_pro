/**
 * @jest-environment node
 */

jest.mock('@/lib/services/api-auth', () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock('@/lib/queries/projects', () => ({
  createProject: jest.fn(),
  getProjectsWithPagination: jest.fn(),
}));

jest.mock('@/lib/services/projectDriveAccess', () => ({
  syncProjectDriveAccess: jest.fn(),
}));

jest.mock('@/lib/session', () => ({
  decrypt: jest.fn(),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { GET, POST } from '@/api/projects/route';
import { ITEMS_PER_PAGE } from '@/config/constants';
import { UserRole } from '@/lib/definitions';
import { validateApiRole, validateHttpMethod } from '@/lib/services/api-auth';
import { createProject, getProjectsWithPagination } from '@/lib/queries/projects';
import { decrypt } from '@/lib/session';
import { cookies } from 'next/headers';
import { syncProjectDriveAccess } from '@/lib/services/projectDriveAccess';

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockCreateProject = createProject as jest.MockedFunction<typeof createProject>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockSyncProjectDriveAccess = syncProjectDriveAccess as jest.MockedFunction<typeof syncProjectDriveAccess>;

async function callPost(req: NextRequest) {
  const response = await POST(req);
  if (!response) throw new Error('POST handler returned undefined');
  return response;
}

describe('POST /api/projects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: 1 as never,
      response: undefined,
    } as never);
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: 'fake-cookie' }),
    } as never);
    mockDecrypt.mockResolvedValue({ id: 77 } as never);
    mockSyncProjectDriveAccess.mockResolvedValue(null);
  });

  it('accepts the full metadata payload and normalizes datetimes', async () => {
    mockCreateProject.mockResolvedValue({ id: 1 } as never);

    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Proyecto',
        brand_id: 2,
        manager_id: 3,
        ideal_delivery_at: '2026-04-07T09:30',
        oc: ' OC-200 ',
        billing_closed_at: '2026-04-20T12:00:00-05:00',
      }),
    });

    const res = await callPost(req);

    expect(res.status).toBe(201);
    expect(mockCreateProject).toHaveBeenCalledWith({
      title: 'Proyecto',
      brand_id: 2,
      manager_id: 3,
      ideal_delivery_at: '2026-04-07T14:30:00.000Z',
      oc: 'OC-200',
      billing_closed_at: '2026-04-20T17:00:00.000Z',
      created_by: 77,
    });
  });

  it('accepts null metadata fields', async () => {
    mockCreateProject.mockResolvedValue({ id: 1 } as never);

    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Proyecto',
        brand_id: 2,
        manager_id: 3,
        ideal_delivery_at: null,
        oc: '   ',
        billing_closed_at: null,
      }),
    });

    const res = await callPost(req);

    expect(res.status).toBe(201);
    expect(mockCreateProject).toHaveBeenCalledWith(expect.objectContaining({
      ideal_delivery_at: null,
      oc: null,
      billing_closed_at: null,
    }));
  });

  it('rejects invalid metadata datetime format', async () => {
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Proyecto',
        brand_id: 2,
        manager_id: 3,
        ideal_delivery_at: '2026/04/07 09:30',
      }),
    });

    const res = await callPost(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/inválidos/i);
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  it('keeps project creation successful and returns a warning when post-create sharing fails', async () => {
    mockCreateProject.mockResolvedValue({ id: 9, drive_folder_id: 'folder-9' } as never);
    mockSyncProjectDriveAccess.mockResolvedValue({
      code: 'DRIVE_ACCESS_SYNC_FAILED',
      message: 'No se pudieron sincronizar todos los accesos de Google Drive.',
    });
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Proyecto', brand_id: 2, manager_id: 3 }),
    });

    const res = await callPost(req);
    expect(res.status).toBe(201);
    expect(mockSyncProjectDriveAccess).toHaveBeenCalledWith(9);
    expect(await res.json()).toMatchObject({
      id: 9,
      driveWarning: { code: 'DRIVE_ACCESS_SYNC_FAILED' },
    });
  });
});

async function callGet(req: NextRequest) {
  const response = await GET(req);
  if (!response) throw new Error('GET handler returned undefined');
  return response;
}

describe('GET /api/projects', () => {
  const mockGetProjects = getProjectsWithPagination as jest.MockedFunction<typeof getProjectsWithPagination>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: 1 as never,
      response: undefined,
    } as never);
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: 'fake-cookie' }),
    } as never);
    mockDecrypt.mockResolvedValue({ id: 77, rol_id: 1 } as never);
    mockGetProjects.mockResolvedValue({ projects: [], total: 0 } as never);
  });

  it.each(['page=0', 'page=abc', 'limit=0', 'limit=abc', 'limit=101'])(
    'rejects invalid pagination %s with 400 and does not query',
    async (qs) => {
      const res = await callGet(new NextRequest(`http://localhost/api/projects?${qs}`));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Parámetros de paginación inválidos' });
      expect(mockGetProjects).not.toHaveBeenCalled();
    }
  );

  it('keeps the default paginated response', async () => {
    mockGetProjects.mockResolvedValue({ projects: [{ id: 1 }], total: 1 } as never);
    const res = await callGet(new NextRequest('http://localhost/api/projects'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [{ id: 1 }], pageCount: 1, currentPage: 1, total: 1 });
    expect(mockGetProjects).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: ITEMS_PER_PAGE, assignedUserId: undefined, createdById: undefined })
    );
  });

  it('scopes visibility by the database role, not the JWT role', async () => {
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: UserRole.COLABORADOR,
      response: undefined,
    } as never);
    mockDecrypt.mockResolvedValue({ id: 77, rol_id: UserRole.ADMIN } as never);
    await callGet(new NextRequest('http://localhost/api/projects'));
    expect(mockGetProjects).toHaveBeenCalledWith(expect.objectContaining({ assignedUserId: 77 }));
  });

  function asRole(role: UserRole) {
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: role,
      response: undefined,
    } as never);
  }

  it.each([UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.FINANCIERO])(
    'filters by the requested creator for role %s',
    async (role) => {
      asRole(role);
      const res = await callGet(new NextRequest('http://localhost/api/projects?created_by=5'));
      expect(res.status).toBe(200);
      expect(mockGetProjects).toHaveBeenCalledWith(
        expect.objectContaining({ createdById: 5, assignedUserId: undefined })
      );
    }
  );

  it('keeps the colaborador scope and adds the requested creator', async () => {
    asRole(UserRole.COLABORADOR);
    await callGet(new NextRequest('http://localhost/api/projects?created_by=5'));
    expect(mockGetProjects).toHaveBeenCalledWith(
      expect.objectContaining({ createdById: 5, assignedUserId: 77 })
    );
  });

  it('never lets a comercial see projects created by someone else', async () => {
    asRole(UserRole.COMERCIAL);
    await callGet(new NextRequest('http://localhost/api/projects?created_by=5'));
    expect(mockGetProjects).toHaveBeenCalledWith(
      expect.objectContaining({ createdById: 77, assignedUserId: undefined })
    );
  });

  it.each(['created_by=abc', 'created_by=0', 'created_by=-3', 'created_by=1.5'])(
    'rejects invalid %s with 400 and does not query',
    async (qs) => {
      const res = await callGet(new NextRequest(`http://localhost/api/projects?${qs}`));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Parámetro created_by inválido' });
      expect(mockGetProjects).not.toHaveBeenCalled();
    }
  );

  it('keeps passing brand, client and manager filters through', async () => {
    await callGet(
      new NextRequest('http://localhost/api/projects?brand_id=3&client_id=4&manager_id=6&search=abc&status=active')
    );
    expect(mockGetProjects).toHaveBeenCalledWith(
      expect.objectContaining({
        brandId: 3,
        clientId: 4,
        managerId: 6,
        search: 'abc',
        status: 'active',
        createdById: undefined,
      })
    );
  });
});
