/**
 * @jest-environment node
 */

jest.mock('@/lib/services/api-auth', () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock('@/lib/queries/projects', () => ({
  getProjectDetail: jest.fn(),
  userCanAccessProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
}));

// El GET lee la sesión para comprobar el acceso de colaboradores
jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: 'session-cookie' }) })),
}));

jest.mock('@/lib/session', () => ({
  decrypt: jest.fn(async () => ({ id: 77, rol_id: 1 })),
}));

jest.mock('@/lib/services/projectDriveAccess', () => ({
  syncProjectDriveAccess: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { PATCH } from '@/api/projects/[id]/route';
import { validateApiRole, validateHttpMethod } from '@/lib/services/api-auth';
import { updateProject } from '@/lib/queries/projects';
import { DomainError } from '@/lib/errors';
import { syncProjectDriveAccess } from '@/lib/services/projectDriveAccess';

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockUpdateProject = updateProject as jest.MockedFunction<typeof updateProject>;

async function callPatch(req: NextRequest, id = '10') {
  const response = await PATCH(req, { params: Promise.resolve({ id }) });
  if (!response) throw new Error('PATCH handler returned undefined');
  return response;
}

describe('PATCH /api/projects/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: 1 as never,
      response: undefined,
    } as never);
  });

  it('accepts partial metadata updates and normalizes values', async () => {
    mockUpdateProject.mockResolvedValue({ id: 10 } as never);

    const req = new NextRequest('http://localhost/api/projects/10', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billing_closed_at: '2026-04-20T12:00',
        oc: '  OC-900  ',
      }),
    });

    const res = await callPatch(req);

    expect(res.status).toBe(200);
    expect(mockUpdateProject).toHaveBeenCalledWith(
      10,
      {
        billing_closed_at: '2026-04-20T17:00:00.000Z',
        oc: 'OC-900',
      }
    );
  });

  it('accepts null metadata updates', async () => {
    mockUpdateProject.mockResolvedValue({ id: 10 } as never);

    const req = new NextRequest('http://localhost/api/projects/10', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ideal_delivery_at: null,
        billing_closed_at: null,
        oc: null,
      }),
    });

    const res = await callPatch(req);

    expect(res.status).toBe(200);
    expect(mockUpdateProject).toHaveBeenCalledWith(
      10,
      {
        ideal_delivery_at: null,
        billing_closed_at: null,
        oc: null,
      }
    );
  });

  it('accepts in-adjustments status updates', async () => {
    mockUpdateProject.mockResolvedValue({ id: 10 } as never);

    const req = new NextRequest('http://localhost/api/projects/10', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_adjustments' }),
    });

    const res = await callPatch(req);

    expect(res.status).toBe(200);
    expect(mockUpdateProject).toHaveBeenCalledWith(10, { status: 'in_adjustments' });
  });

  // Spec: odd/tasks/brand-owned-project-manager.md — S3
  it.each([
    [{ manager_id: 12 }],
    [{ manager_id: 12, title: 'Nuevo título' }],
    [{ manager_id: null }],
  ])('S3: rejects %j with 400 and writes nothing', async (body) => {
    const req = new NextRequest('http://localhost/api/projects/10', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await callPatch(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'El gerente del proyecto se cambia reasignando su marca',
    });
    expect(mockUpdateProject).not.toHaveBeenCalled();
    expect(syncProjectDriveAccess).not.toHaveBeenCalled();
  });

  it('keeps translating domain errors from updateProject to 4xx', async () => {
    mockUpdateProject.mockRejectedValue(
      new DomainError('BRAND_CLIENT_MISMATCH', 'La marca pertenece a otro cliente')
    );

    const req = new NextRequest('http://localhost/api/projects/10', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ additional_brand_ids: [99] }),
    });

    const res = await callPatch(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'La marca pertenece a otro cliente',
      code: 'BRAND_CLIENT_MISMATCH',
    });
  });

  it('rejects invalid project metadata datetime values', async () => {
    const req = new NextRequest('http://localhost/api/projects/10', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billing_closed_at: '20-04-2026 12:00',
      }),
    });

    const res = await callPatch(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/inválidos/i);
    expect(mockUpdateProject).not.toHaveBeenCalled();
  });

  describe('drive_folder_url', () => {
    it('persists the url and the parsed folder id for a valid Drive URL', async () => {
      mockUpdateProject.mockResolvedValue({ id: 10 } as never);

      const req = new NextRequest('http://localhost/api/projects/10', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drive_folder_url: 'https://drive.google.com/drive/folders/abc123XYZ_-',
        }),
      });

      const res = await callPatch(req);

      expect(res.status).toBe(200);
      expect(mockUpdateProject).toHaveBeenCalledWith(
        10,
        {
          drive_folder_url: 'https://drive.google.com/drive/folders/abc123XYZ_-',
          drive_folder_id: 'abc123XYZ_-',
        }
      );
    });

    it('derives the folder id even when a stale drive_folder_id was also sent', async () => {
      mockUpdateProject.mockResolvedValue({ id: 10 } as never);

      const req = new NextRequest('http://localhost/api/projects/10', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drive_folder_url: 'https://drive.google.com/drive/u/0/folders/newFolderId',
          drive_folder_id: 'stale-id',
        }),
      });

      const res = await callPatch(req);

      expect(res.status).toBe(200);
      expect(mockUpdateProject).toHaveBeenCalledWith(
        10,
        {
          drive_folder_url: 'https://drive.google.com/drive/u/0/folders/newFolderId',
          drive_folder_id: 'newFolderId',
        }
      );
    });

    it('rejects a non-Drive domain with 400 and does not call updateProject', async () => {
      const req = new NextRequest('http://localhost/api/projects/10', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drive_folder_url: 'https://evil-drive.google.com.attacker.io/folders/abc123',
        }),
      });

      const res = await callPatch(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/inválidos/i);
      expect(mockUpdateProject).not.toHaveBeenCalled();
    });

    it('rejects a malformed URL with 400', async () => {
      const req = new NextRequest('http://localhost/api/projects/10', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drive_folder_url: 'not-a-valid-url',
        }),
      });

      const res = await callPatch(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/inválidos/i);
      expect(mockUpdateProject).not.toHaveBeenCalled();
    });

    it('unlinks both drive_folder_url and drive_folder_id when the value is an empty string', async () => {
      mockUpdateProject.mockResolvedValue({ id: 10 } as never);

      const req = new NextRequest('http://localhost/api/projects/10', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drive_folder_url: '',
        }),
      });

      const res = await callPatch(req);

      expect(res.status).toBe(200);
      expect(mockUpdateProject).toHaveBeenCalledWith(
        10,
        {
          drive_folder_url: null,
          drive_folder_id: null,
        }
      );
    });

    it('allows explicit null without triggering the domain refine or touching drive_folder_id', async () => {
      mockUpdateProject.mockResolvedValue({ id: 10 } as never);

      const req = new NextRequest('http://localhost/api/projects/10', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drive_folder_url: null,
        }),
      });

      const res = await callPatch(req);

      expect(res.status).toBe(200);
      expect(mockUpdateProject).toHaveBeenCalledWith(10, { drive_folder_url: null });
    });

    it('leaves drive_folder_url untouched when omitted from the body (no regression)', async () => {
      mockUpdateProject.mockResolvedValue({ id: 10 } as never);

      const req = new NextRequest('http://localhost/api/projects/10', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Nuevo título' }),
      });

      const res = await callPatch(req);

      expect(res.status).toBe(200);
      expect(mockUpdateProject).toHaveBeenCalledWith(10, { title: 'Nuevo título' });
    });

    it('rejects the request when the caller lacks PROJECT_EDIT_ROLES', async () => {
      mockValidateApiRole.mockResolvedValue({
        isAuthorized: false,
        response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
      } as never);

      const req = new NextRequest('http://localhost/api/projects/10', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drive_folder_url: 'https://drive.google.com/drive/folders/abc123',
        }),
      });

      const res = await callPatch(req);

      expect(res.status).toBe(403);
      expect(mockUpdateProject).not.toHaveBeenCalled();
    });
  });
});

// S5: project detail is only visible to non-operations roles with access to the project.
describe('GET /api/projects/[id] access', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GET } = require('@/api/projects/[id]/route');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getProjectDetail, userCanAccessProject } = require('@/lib/queries/projects');
  const { PROJECT_VIEW_ROLES } = jest.requireActual('@/lib/role-groups');

  const callGet = (id = '10') =>
    GET(new NextRequest(`http://localhost/api/projects/${id}`), { params: Promise.resolve({ id }) });

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    (getProjectDetail as jest.Mock).mockResolvedValue({ id: 10, title: 'P' });
  });

  it('returns the project to an operations role without the access check (previous behavior)', async () => {
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 3, response: undefined } as never);

    const res = await callGet();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 10, title: 'P' });
    expect(mockValidateApiRole).toHaveBeenCalledWith(expect.anything(), PROJECT_VIEW_ROLES);
    expect(userCanAccessProject).not.toHaveBeenCalled();
  });

  it('returns 403 to a collaborator without access and does not load the project', async () => {
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 4, response: undefined } as never);
    (userCanAccessProject as jest.Mock).mockResolvedValue(false);

    const res = await callGet();

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'No tienes acceso a este proyecto' });
    expect(userCanAccessProject).toHaveBeenCalledWith(10, 77, 4);
    expect(getProjectDetail).not.toHaveBeenCalled();
  });

  it('returns the project to a collaborator with access', async () => {
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 4, response: undefined } as never);
    (userCanAccessProject as jest.Mock).mockResolvedValue(true);

    const res = await callGet();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 10, title: 'P' });
  });

  it('returns 404 when the project does not exist (previous behavior)', async () => {
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined } as never);
    (getProjectDetail as jest.Mock).mockResolvedValue(null);

    const res = await callGet();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Proyecto no encontrado' });
  });
});
