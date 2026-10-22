/**
 * @jest-environment node
 */
// S7: GET /api/projects/[id]/tasks/[tid]/cost — admin, directivo and financiero only.
jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: 'c' }) })),
}));
jest.mock('@/lib/session', () => ({ decrypt: jest.fn() }));
jest.mock('@/lib/queries/userEmailConnections', () => ({
  isGmailConnectionRequired: jest.fn(() => false),
  getUserConnectedEmailStatus: jest.fn(async () => true),
}));
jest.mock('@/lib/queries/taskCost', () => ({ getTaskCost: jest.fn(), updateTaskCost: jest.fn() }));

import { NextRequest } from 'next/server';
import { GET, PATCH } from '@/api/projects/[id]/tasks/[tid]/cost/route';
import { decrypt } from '@/lib/session';
import { getTaskCost, updateTaskCost } from '@/lib/queries/taskCost';
import { UserRole } from '@/lib/definitions';

const mockDecrypt = decrypt as jest.Mock;
const mockGetTaskCost = getTaskCost as jest.Mock;
const mockUpdateTaskCost = updateTaskCost as jest.Mock;

const cost = { cost: 45000, internal: true, minutes: 90, hourly_rate: 30000, source: 'frozen_rate' };

function as(role: UserRole, id = 1) {
  mockDecrypt.mockResolvedValue({ id, email: 'x@test.com', rol_id: role });
}
function req(method = 'GET', id = '65', tid = '141') {
  return {
    request: new NextRequest(`http://localhost/api/projects/${id}/tasks/${tid}/cost`, { method }),
    ctx: { params: Promise.resolve({ id, tid }) },
  };
}
async function run(method = 'GET', id = '65', tid = '141') {
  const { request, ctx } = req(method, id, tid);
  const res = await GET(request, ctx);
  if (!res) throw new Error('handler returned undefined');
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTaskCost.mockResolvedValue(cost);
});

describe('GET /api/projects/[id]/tasks/[tid]/cost', () => {
  it.each([UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.FINANCIERO])('returns the task cost for role %i', async (role) => {
    as(role);
    const res = await run();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(cost);
    expect(mockGetTaskCost).toHaveBeenCalledWith(65, 141);
  });

  it.each([UserRole.COMERCIAL, UserRole.COLABORADOR])('forbids role %i with 403', async (role) => {
    as(role);
    const res = await run();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Acceso prohibido: No tienes permisos para esta operación' });
    expect(mockGetTaskCost).not.toHaveBeenCalled();
  });

  it('returns 404 when the task does not exist in the project', async () => {
    as(UserRole.DIRECTIVO);
    mockGetTaskCost.mockResolvedValue(null);
    const res = await run();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Tarea no encontrada' });
  });

  it('returns 400 for invalid ids without reading', async () => {
    as(UserRole.ADMIN);
    const res = await run('GET', 'abc', '141');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'ID inválido' });
    expect(mockGetTaskCost).not.toHaveBeenCalled();
  });

  it('returns 405 for other methods', async () => {
    as(UserRole.ADMIN);
    const res = await run('POST');
    expect(res.status).toBe(405);
    expect(await res.json()).toEqual({ error: 'Método POST no permitido' });
    expect(mockGetTaskCost).not.toHaveBeenCalled();
  });

  it('returns 500 with a JSON error when the read fails', async () => {
    as(UserRole.ADMIN);
    mockGetTaskCost.mockRejectedValue(new Error('db down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await run();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al obtener el costo de la tarea' });
  });
});

// S15, S16: PATCH corrects the cost of a completed external task (admin, directivo).
describe('PATCH /api/projects/[id]/tasks/[tid]/cost', () => {
  const corrected = {
    cost: 650000, internal: false, minutes: 60, hourly_rate: null, source: 'declared',
    editable: true, original_cost: 500000, updated_by_name: 'Diana', updated_at: '2026-05-03T15:00:00.000Z',
  };
  const COST_ERROR = 'El costo debe ser un número mayor o igual a 0';

  async function patchCost(body: unknown, method = 'PATCH', id = '65', tid = '141') {
    const request = new NextRequest(`http://localhost/api/projects/${id}/tasks/${tid}/cost`, {
      method,
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(request, { params: Promise.resolve({ id, tid }) });
    if (!res) throw new Error('handler returned undefined');
    return res;
  }

  beforeEach(() => {
    mockUpdateTaskCost.mockResolvedValue('updated');
    mockGetTaskCost.mockResolvedValue(corrected);
  });

  it.each([UserRole.ADMIN, UserRole.DIRECTIVO])('corrects the cost for role %i and returns the fresh cost', async (role) => {
    as(role, 7);
    const res = await patchCost({ completion_cost: 650000 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(corrected);
    expect(mockUpdateTaskCost).toHaveBeenCalledWith(65, 141, 650000, 7);
    expect(mockGetTaskCost).toHaveBeenCalledWith(65, 141);
  });

  it('accepts 0 as a valid cost', async () => {
    as(UserRole.DIRECTIVO, 7);
    const res = await patchCost({ completion_cost: 0 });
    expect(res.status).toBe(200);
    expect(mockUpdateTaskCost).toHaveBeenCalledWith(65, 141, 0, 7);
  });

  it.each([UserRole.FINANCIERO, UserRole.COMERCIAL, UserRole.COLABORADOR])('forbids role %i with 403 without writing', async (role) => {
    as(role);
    const res = await patchCost({ completion_cost: 650000 });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Acceso prohibido: No tienes permisos para esta operación' });
    expect(mockUpdateTaskCost).not.toHaveBeenCalled();
  });

  it.each([
    ['negative', { completion_cost: -1 }],
    ['string', { completion_cost: '650000' }],
    ['null', { completion_cost: null }],
    ['missing', {}],
    ['invalid JSON', '{nope'],
  ])('rejects a %s cost with 400 without writing', async (_label, body) => {
    as(UserRole.DIRECTIVO);
    const res = await patchCost(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: COST_ERROR });
    expect(mockUpdateTaskCost).not.toHaveBeenCalled();
  });

  it('rejects invalid ids with 400 without writing', async () => {
    as(UserRole.ADMIN);
    const res = await patchCost({ completion_cost: 1 }, 'PATCH', '65', 'x');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'ID inválido' });
    expect(mockUpdateTaskCost).not.toHaveBeenCalled();
  });

  it.each([
    ['not_found', 404, 'Tarea no encontrada'],
    ['not_completed', 400, 'Solo se puede corregir el costo de una tarea completada'],
    ['internal', 400, 'El costo de una tarea interna se calcula con el sueldo y no se puede editar'],
  ])('maps %s to %i', async (reason, status, error) => {
    as(UserRole.DIRECTIVO);
    mockUpdateTaskCost.mockResolvedValue(reason);
    const res = await patchCost({ completion_cost: 650000 });
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
    expect(mockGetTaskCost).not.toHaveBeenCalled();
  });

  it('returns 405 for other methods without writing', async () => {
    as(UserRole.ADMIN);
    const res = await patchCost({ completion_cost: 1 }, 'POST');
    expect(res.status).toBe(405);
    expect(await res.json()).toEqual({ error: 'Método POST no permitido' });
    expect(mockUpdateTaskCost).not.toHaveBeenCalled();
  });

  it('returns 500 with a JSON error when the write fails', async () => {
    as(UserRole.ADMIN);
    mockUpdateTaskCost.mockRejectedValue(new Error('db down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await patchCost({ completion_cost: 1 });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Error al corregir el costo de la tarea' });
  });
});
