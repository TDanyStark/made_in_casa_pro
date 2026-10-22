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
jest.mock('@/lib/queries/taskCost', () => ({ getTaskCost: jest.fn() }));

import { NextRequest } from 'next/server';
import { GET } from '@/api/projects/[id]/tasks/[tid]/cost/route';
import { decrypt } from '@/lib/session';
import { getTaskCost } from '@/lib/queries/taskCost';
import { UserRole } from '@/lib/definitions';

const mockDecrypt = decrypt as jest.Mock;
const mockGetTaskCost = getTaskCost as jest.Mock;

const cost = { cost: 45000, internal: true, minutes: 90, hourly_rate: 30000, source: 'frozen_rate' };

function as(role: UserRole) {
  mockDecrypt.mockResolvedValue({ id: 1, email: 'x@test.com', rol_id: role });
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
