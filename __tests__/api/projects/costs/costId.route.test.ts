/**
 * @jest-environment node
 */
// Spec: odd/tasks/project-costs.md — S2, S5, S6: PATCH and DELETE /api/projects/[id]/costs/[costId].
jest.mock('@/lib/services/api-auth', () => ({
  validateHttpMethod: jest.fn(() => ({ isValidMethod: true })),
  validateApiRole: jest.fn(),
}));
jest.mock('@/lib/queries/projectCosts', () => ({
  getProjectCost: jest.fn(),
  updateProjectCost: jest.fn(),
  deleteProjectCost: jest.fn(),
}));
jest.mock('@/lib/queries/projects', () => ({
  userCanAccessProject: jest.fn(),
}));
jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: 'c' }) })),
}));
jest.mock('@/lib/session', () => ({
  decrypt: jest.fn(async () => ({ id: 77, rol_id: 3 })),
}));

import { NextRequest, NextResponse } from 'next/server';
import { PATCH, DELETE } from '@/api/projects/[id]/costs/[costId]/route';
import { validateApiRole } from '@/lib/services/api-auth';
import { getProjectCost, updateProjectCost, deleteProjectCost } from '@/lib/queries/projectCosts';
import { userCanAccessProject } from '@/lib/queries/projects';
import { ProjectCostError, UserRole } from '@/lib/definitions';

const mockRole = validateApiRole as jest.Mock;
const mockGet = getProjectCost as jest.Mock;
const mockUpdate = updateProjectCost as jest.Mock;
const mockDelete = deleteProjectCost as jest.Mock;
const mockAccess = userCanAccessProject as jest.Mock;

const params = { params: Promise.resolve({ id: '10', costId: '5' }) };
const cost = { id: 5, project_id: 10, adjustment_id: 4, amount: 2000, category_id: 2 };
const PROJECT_COSTS_ROLES = [UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.FINANCIERO, UserRole.COMERCIAL];

function as(role: UserRole) {
  mockRole.mockResolvedValue({ isAuthorized: true, userRole: role });
}
function req(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/projects/10/costs/5', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function run(h: (r: NextRequest, p: typeof params) => Promise<Response | undefined>, r: NextRequest, p = params) {
  const res = await h(r, p);
  if (!res) throw new Error('handler returned undefined');
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccess.mockResolvedValue(true);
  mockGet.mockResolvedValue(cost);
  mockUpdate.mockResolvedValue(cost);
  mockDelete.mockResolvedValue(true);
});

describe('PATCH /api/projects/[id]/costs/[costId]', () => {
  it('updates the given fields recording the editor (financiero allowed)', async () => {
    as(UserRole.FINANCIERO);
    const res = await run(PATCH, req('PATCH', { amount: '2.000', description: '  ', task_id: null }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(cost);
    expect(mockRole.mock.calls[0][1]).toEqual(PROJECT_COSTS_ROLES);
    expect(mockGet).toHaveBeenCalledWith(10, 5);
    expect(mockUpdate).toHaveBeenCalledWith(10, 5, { amount: 2000, description: null, task_id: null }, 77);
  });

  it('lets a commercial edit a cost of a project they created', async () => {
    as(UserRole.COMERCIAL);
    const res = await run(PATCH, req('PATCH', { adjustment_id: 7 }));
    expect(res.status).toBe(200);
    expect(mockAccess).toHaveBeenCalledWith(10, 77, UserRole.COMERCIAL);
    expect(mockUpdate).toHaveBeenCalledWith(10, 5, { adjustment_id: 7 }, 77);
  });

  it('rejects a commercial on a project they did not create with 403 and changes nothing', async () => {
    as(UserRole.COMERCIAL);
    mockAccess.mockResolvedValue(false);
    const res = await run(PATCH, req('PATCH', { amount: 1 }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'No tienes acceso a este proyecto' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns the role rejection (colaborador) unchanged', async () => {
    mockRole.mockResolvedValue({ isAuthorized: false, response: NextResponse.json({ error: 'x' }, { status: 403 }) });
    const res = await run(PATCH, req('PATCH', { amount: 1 }));
    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 for a cost of another project and changes nothing', async () => {
    as(UserRole.ADMIN);
    mockGet.mockResolvedValue(null);
    const res = await run(PATCH, req('PATCH', { amount: 1 }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Costo no encontrado' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it.each([[{ amount: 'abc' }, 'Ingresa un precio válido en pesos (solo números)'], [{ amount: 0 }, 'El monto debe ser mayor que 0'], [{}, 'No hay cambios para guardar'], [{ adjustment_id: null }, 'Versión inválida']])(
    'rejects %j with 400 and changes nothing', async (body, error) => {
      as(UserRole.ADMIN);
      const res = await run(PATCH, req('PATCH', body));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error });
      expect(mockUpdate).not.toHaveBeenCalled();
    }
  );

  it('maps a link error from the query to 400', async () => {
    as(UserRole.ADMIN);
    mockUpdate.mockRejectedValue(new ProjectCostError('La versión indicada no pertenece al proyecto.'));
    const res = await run(PATCH, req('PATCH', { adjustment_id: 99 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'La versión indicada no pertenece al proyecto.' });
  });

  it('returns 400 for an invalid cost id without reading it', async () => {
    as(UserRole.ADMIN);
    const res = await run(PATCH, req('PATCH', { amount: 1 }), { params: Promise.resolve({ id: '10', costId: 'x' }) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'ID de costo inválido' });
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/projects/[id]/costs/[costId]', () => {
  it('deletes the cost (directivo)', async () => {
    as(UserRole.DIRECTIVO);
    const res = await run(DELETE, req('DELETE'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockRole.mock.calls[0][1]).toEqual(PROJECT_COSTS_ROLES);
    expect(mockDelete).toHaveBeenCalledWith(10, 5);
  });

  it('lets a commercial delete a cost of a project they created', async () => {
    as(UserRole.COMERCIAL);
    const res = await run(DELETE, req('DELETE'));
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(10, 5);
  });

  it('rejects a commercial on a project they did not create with 403 and deletes nothing', async () => {
    as(UserRole.COMERCIAL);
    mockAccess.mockResolvedValue(false);
    const res = await run(DELETE, req('DELETE'));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'No tienes acceso a este proyecto' });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns the role rejection (colaborador) unchanged', async () => {
    mockRole.mockResolvedValue({ isAuthorized: false, response: NextResponse.json({ error: 'x' }, { status: 403 }) });
    const res = await run(DELETE, req('DELETE'));
    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 404 for a cost of another project and deletes nothing', async () => {
    as(UserRole.ADMIN);
    mockGet.mockResolvedValue(null);
    const res = await run(DELETE, req('DELETE'));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Costo no encontrado' });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
