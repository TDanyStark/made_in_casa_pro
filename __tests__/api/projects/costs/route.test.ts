/**
 * @jest-environment node
 */
// Spec: odd/tasks/project-costs.md — S2, S5, S6: GET and POST /api/projects/[id]/costs.
jest.mock('@/lib/services/api-auth', () => ({
  validateHttpMethod: jest.fn(() => ({ isValidMethod: true })),
  validateApiRole: jest.fn(),
}));
jest.mock('@/lib/queries/projectCosts', () => ({
  getProjectCostVersions: jest.fn(),
  listProjectCosts: jest.fn(),
  getProjectCostsTotal: jest.fn(),
  createProjectCost: jest.fn(),
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
import { GET, POST } from '@/api/projects/[id]/costs/route';
import { validateApiRole } from '@/lib/services/api-auth';
import {
  getProjectCostVersions,
  listProjectCosts,
  getProjectCostsTotal,
  createProjectCost,
} from '@/lib/queries/projectCosts';
import { userCanAccessProject } from '@/lib/queries/projects';
import { ProjectCostError, UserRole } from '@/lib/definitions';

const mockRole = validateApiRole as jest.Mock;
const mockVersions = getProjectCostVersions as jest.Mock;
const mockList = listProjectCosts as jest.Mock;
const mockTotal = getProjectCostsTotal as jest.Mock;
const mockCreate = createProjectCost as jest.Mock;
const mockAccess = userCanAccessProject as jest.Mock;

const params = { params: Promise.resolve({ id: '10' }) };
const oneVersion = [{ id: 4, version_number: 1 }];
const twoVersions = [...oneVersion, { id: 7, version_number: 2 }];
const cost = { id: 5, project_id: 10, adjustment_id: 4, amount: 1500000, category_id: 2 };
const totals = { total: 1500000, by_category: [{ category_id: 2, category_name: 'Otro', total: 1500000 }] };

function as(role: UserRole) {
  mockRole.mockResolvedValue({ isAuthorized: true, userRole: role });
}
function req(method: string, body?: unknown, query = '') {
  return new NextRequest(`http://localhost/api/projects/10/costs${query}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}
async function run(h: (r: NextRequest, p: typeof params) => Promise<Response | undefined>, r: NextRequest) {
  const res = await h(r, params);
  if (!res) throw new Error('handler returned undefined');
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccess.mockResolvedValue(true);
  mockVersions.mockResolvedValue(twoVersions);
  mockList.mockResolvedValue([cost]);
  mockTotal.mockResolvedValue(totals);
  mockCreate.mockResolvedValue(cost);
});

const PROJECT_COSTS_ROLES = [UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.FINANCIERO, UserRole.COMERCIAL];

describe('GET /api/projects/[id]/costs', () => {
  it.each([UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.FINANCIERO])('returns costs, total and versions to role %s', async (role) => {
    as(role);
    const res = await run(GET, req('GET'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ costs: [cost], ...totals, versions: twoVersions, adjustment_id: null });
    expect(mockRole.mock.calls[0][1]).toEqual(PROJECT_COSTS_ROLES);
    expect(mockList).toHaveBeenCalledWith(10, null);
    expect(mockTotal).toHaveBeenCalledWith(10, null);
    expect(mockAccess).not.toHaveBeenCalled();
  });

  it('lets a commercial read the costs of a project they created', async () => {
    as(UserRole.COMERCIAL);
    const res = await run(GET, req('GET'));
    expect(res.status).toBe(200);
    expect(mockAccess).toHaveBeenCalledWith(10, 77, UserRole.COMERCIAL);
  });

  it('rejects a commercial on a project they did not create with 403', async () => {
    as(UserRole.COMERCIAL);
    mockAccess.mockResolvedValue(false);
    const res = await run(GET, req('GET'));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'No tienes acceso a este proyecto' });
    expect(mockList).not.toHaveBeenCalled();
  });

  it('returns the role rejection (colaborador) unchanged', async () => {
    mockRole.mockResolvedValue({ isAuthorized: false, response: NextResponse.json({ error: 'x' }, { status: 403 }) });
    const res = await run(GET, req('GET'));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'x' });
    expect(mockList).not.toHaveBeenCalled();
  });

  it('filters by version with ?adjustment_id (S5)', async () => {
    as(UserRole.ADMIN);
    const res = await run(GET, req('GET', undefined, '?adjustment_id=7'));
    expect(res.status).toBe(200);
    expect((await res.json()).adjustment_id).toBe(7);
    expect(mockList).toHaveBeenCalledWith(10, 7);
    expect(mockTotal).toHaveBeenCalledWith(10, 7);
  });

  it.each(['abc', '0', '-1', '1.5', ''])('rejects ?adjustment_id=%s with 400', async (value) => {
    as(UserRole.ADMIN);
    const res = await run(GET, req('GET', undefined, `?adjustment_id=${value}`));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Versión inválida' });
    expect(mockList).not.toHaveBeenCalled();
  });

  it('returns 404 for a version of another project', async () => {
    as(UserRole.ADMIN);
    const res = await run(GET, req('GET', undefined, '?adjustment_id=99'));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Versión no encontrada' });
    expect(mockList).not.toHaveBeenCalled();
  });

  it('returns 404 when the project does not exist (no versions)', async () => {
    as(UserRole.ADMIN);
    mockVersions.mockResolvedValue([]);
    const res = await run(GET, req('GET'));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Proyecto no encontrado' });
  });

  it('returns 400 for a non-numeric project id', async () => {
    as(UserRole.ADMIN);
    const res = await GET(req('GET'), { params: Promise.resolve({ id: 'abc' }) });
    expect(res?.status).toBe(400);
    expect(await res?.json()).toEqual({ error: 'ID de proyecto inválido' });
  });
});

describe('POST /api/projects/[id]/costs', () => {
  const body = { category_id: 2, amount: 1500000, description: 'Pago comercial abril', adjustment_id: 7 };

  it('creates the cost with the session user as creator (financiero allowed)', async () => {
    as(UserRole.FINANCIERO);
    const res = await run(POST, req('POST', { ...body, incurred_at: '2026-04-01', task_id: 8 }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(cost);
    expect(mockRole.mock.calls[0][1]).toEqual(PROJECT_COSTS_ROLES);
    expect(mockCreate).toHaveBeenCalledWith(10, {
      adjustment_id: 7, category_id: 2, description: 'Pago comercial abril', amount: 1500000,
      incurred_at: '2026-04-01', task_id: 8,
    }, 77);
  });

  it('lets a commercial add a cost to a project they created', async () => {
    as(UserRole.COMERCIAL);
    const res = await run(POST, req('POST', body));
    expect(res.status).toBe(201);
    expect(mockAccess).toHaveBeenCalledWith(10, 77, UserRole.COMERCIAL);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('rejects a commercial on a project they did not create with 403 and stores nothing', async () => {
    as(UserRole.COMERCIAL);
    mockAccess.mockResolvedValue(false);
    const res = await run(POST, req('POST', body));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'No tienes acceso a este proyecto' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns the role rejection (colaborador) unchanged and stores nothing', async () => {
    mockRole.mockResolvedValue({ isAuthorized: false, response: NextResponse.json({ error: 'x' }, { status: 403 }) });
    const res = await run(POST, req('POST', body));
    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // S5
  it('requires the version when the project has 2+ versions', async () => {
    as(UserRole.ADMIN);
    const res = await run(POST, req('POST', { category_id: 2, amount: 10 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Selecciona la versión del proyecto a la que pertenece el costo.' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('takes the only version when the project has one and none is given', async () => {
    as(UserRole.ADMIN);
    mockVersions.mockResolvedValue(oneVersion);
    const res = await run(POST, req('POST', { category_id: 2, amount: 10 }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(10, {
      adjustment_id: 4, category_id: 2, description: null, amount: 10, incurred_at: null, task_id: null,
    }, 77);
  });

  it('rejects a version of another project with 400 and stores nothing', async () => {
    as(UserRole.ADMIN);
    const res = await run(POST, req('POST', { ...body, adjustment_id: 99 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'La versión indicada no pertenece al proyecto.' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 404 when the project does not exist and stores nothing', async () => {
    as(UserRole.ADMIN);
    mockVersions.mockResolvedValue([]);
    const res = await run(POST, req('POST', body));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Proyecto no encontrado' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it.each([
    ['1.500.000', 1500000],
    ['$ 250.000,50', 250000.5],
  ])('accepts the COP amount string %s', async (amount, parsed) => {
    as(UserRole.ADMIN);
    const res = await run(POST, req('POST', { ...body, amount }));
    expect(res.status).toBe(201);
    expect(mockCreate.mock.calls[0][1].amount).toBe(parsed);
  });

  it.each([['abc'], [''], [null], [true], [1e12]])('rejects the invalid amount %j with 400 and stores nothing', async (amount) => {
    as(UserRole.ADMIN);
    const res = await run(POST, req('POST', { ...body, amount }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Ingresa un precio válido en pesos (solo números)' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it.each([[0], [-5], ['0']])('rejects a non-positive amount %j with 400', async (amount) => {
    as(UserRole.ADMIN);
    const res = await run(POST, req('POST', { ...body, amount }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'El monto debe ser mayor que 0' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects a missing amount with 400', async () => {
    as(UserRole.ADMIN);
    const res = await run(POST, req('POST', { category_id: 2, adjustment_id: 7 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Ingresa un precio válido en pesos (solo números)' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('requires a category (S6)', async () => {
    as(UserRole.ADMIN);
    const res = await run(POST, req('POST', { amount: 10, adjustment_id: 7 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Selecciona una categoría' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it.each(['2026-13-01', '01/04/2026', '2026-02-30'])('rejects the invalid date %s', async (incurred_at) => {
    as(UserRole.ADMIN);
    const res = await run(POST, req('POST', { ...body, incurred_at }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Fecha inválida' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects a malformed JSON body', async () => {
    as(UserRole.ADMIN);
    const res = await run(POST, req('POST', '{nope'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Datos inválidos' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('maps a link error from the query (task of another version) to 400', async () => {
    as(UserRole.ADMIN);
    mockCreate.mockRejectedValue(new ProjectCostError('La tarea indicada no pertenece a esa versión del proyecto.'));
    const res = await run(POST, req('POST', { ...body, task_id: 8 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'La tarea indicada no pertenece a esa versión del proyecto.' });
  });

  it('returns 500 on an unexpected error', async () => {
    as(UserRole.ADMIN);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockCreate.mockRejectedValue(new Error('boom'));
    const res = await run(POST, req('POST', body));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al guardar el costo' });
  });
});
