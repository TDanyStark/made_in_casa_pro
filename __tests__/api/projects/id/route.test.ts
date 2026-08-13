/**
 * @jest-environment node
 */

jest.mock('@/lib/services/api-auth', () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock('@/lib/queries/projects', () => ({
  getProjectDetail: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
}));

// El PATCH lee la sesión para registrar `changed_by` en project_manager_history
jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: 'session-cookie' }) })),
}));

jest.mock('@/lib/session', () => ({
  decrypt: jest.fn(async () => ({ id: 77, rol_id: 1 })),
}));

import { NextRequest } from 'next/server';
import { PATCH } from '@/api/projects/[id]/route';
import { validateApiRole, validateHttpMethod } from '@/lib/services/api-auth';
import { updateProject } from '@/lib/queries/projects';
import { DomainError } from '@/lib/errors';

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
      },
      77 // changed_by tomado de la sesión
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
      },
      77
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
    expect(mockUpdateProject).toHaveBeenCalledWith(10, { status: 'in_adjustments' }, 77);
  });

  it('accepts manager_id and forwards the session user as changed_by', async () => {
    mockUpdateProject.mockResolvedValue({ id: 10 } as never);

    const req = new NextRequest('http://localhost/api/projects/10', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manager_id: 12 }),
    });

    const res = await callPatch(req);

    expect(res.status).toBe(200);
    expect(mockUpdateProject).toHaveBeenCalledWith(10, { manager_id: 12 }, 77);
  });

  it('returns 400 with a clear message when the manager belongs to another client', async () => {
    mockUpdateProject.mockRejectedValue(
      new DomainError(
        'MANAGER_CLIENT_MISMATCH',
        'El gerente pertenece a otro cliente. Un proyecto solo puede asignarse a gerentes de su mismo cliente.'
      )
    );

    const req = new NextRequest('http://localhost/api/projects/10', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manager_id: 999 }),
    });

    const res = await callPatch(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.code).toBe('MANAGER_CLIENT_MISMATCH');
    expect(data.error).toMatch(/otro cliente/i);
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
        },
        77
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
        },
        77
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
        },
        77
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
      expect(mockUpdateProject).toHaveBeenCalledWith(10, { drive_folder_url: null }, 77);
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
      expect(mockUpdateProject).toHaveBeenCalledWith(10, { title: 'Nuevo título' }, 77);
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
