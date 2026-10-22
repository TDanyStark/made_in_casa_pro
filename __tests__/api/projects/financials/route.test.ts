/**
 * @jest-environment node
 */
// S1, S2: GET financials and PATCH sale price for /api/projects/[id]/financials.
jest.mock('@/lib/services/api-auth', () => ({
  validateHttpMethod: jest.fn(() => ({ isValidMethod: true })),
  validateApiRole: jest.fn(),
}));
jest.mock('@/lib/queries/projectFinancials', () => ({
  getProjectFinancials: jest.fn(),
  updateProjectSalePrice: jest.fn(),
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
import { GET, PATCH } from '@/api/projects/[id]/financials/route';
import { validateApiRole } from '@/lib/services/api-auth';
import { getProjectFinancials, updateProjectSalePrice } from '@/lib/queries/projectFinancials';
import { userCanAccessProject } from '@/lib/queries/projects';
import { UserRole } from '@/lib/definitions';

const mockRole = validateApiRole as jest.Mock;
const mockGet = getProjectFinancials as jest.Mock;
const mockUpdate = updateProjectSalePrice as jest.Mock;
const mockAccess = userCanAccessProject as jest.Mock;

const params = { params: Promise.resolve({ id: '10' }) };
const summary = { sale_price: 100, total_cost: 40, margin: 60 };

function as(role: UserRole) {
  mockRole.mockResolvedValue({ isAuthorized: true, userRole: role });
}
function req(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/projects/10/financials', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
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
  mockGet.mockResolvedValue(summary);
  mockUpdate.mockResolvedValue(true);
});

describe('GET /api/projects/[id]/financials', () => {
  it('returns the summary for leadership and commercial roles, not collaborators', async () => {
    as(UserRole.DIRECTIVO);
    const res = await run(GET, req('GET'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(summary);
    const roles = mockRole.mock.calls[0][1];
    expect(roles).toEqual(expect.arrayContaining([UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.FINANCIERO, UserRole.COMERCIAL]));
    expect(roles).not.toContain(UserRole.COLABORADOR);
    expect(mockGet).toHaveBeenCalledWith(10);
  });

  it('returns the role rejection response unchanged', async () => {
    mockRole.mockResolvedValue({ isAuthorized: false, response: NextResponse.json({ error: 'x' }, { status: 403 }) });
    const res = await run(GET, req('GET'));
    expect(res.status).toBe(403);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('rejects a commercial who did not create the project with 403', async () => {
    as(UserRole.COMERCIAL);
    mockAccess.mockResolvedValue(false);
    const res = await run(GET, req('GET'));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'No tienes acceso a este proyecto' });
    expect(mockAccess).toHaveBeenCalledWith(10, 77, UserRole.COMERCIAL);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns 404 when the project does not exist', async () => {
    as(UserRole.ADMIN);
    mockGet.mockResolvedValue(null);
    const res = await run(GET, req('GET'));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Proyecto no encontrado' });
  });

  it('returns 400 for a non-numeric id', async () => {
    as(UserRole.ADMIN);
    const res = await GET(req('GET'), { params: Promise.resolve({ id: 'abc' }) });
    expect(res?.status).toBe(400);
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/projects/[id]/financials', () => {
  it('lets admin, directivo and commercial set the sale price, not financiero', async () => {
    as(UserRole.DIRECTIVO);
    const res = await run(PATCH, req('PATCH', { sale_price: 2500000 }));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(10, 2500000);
    expect(await res.json()).toEqual(summary);
    const roles = mockRole.mock.calls[0][1];
    expect(roles).toEqual([UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL]);
  });

  it('clears the sale price with null', async () => {
    as(UserRole.ADMIN);
    const res = await run(PATCH, req('PATCH', { sale_price: null }));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(10, null);
  });

  it.each([[{ sale_price: -1 }], [{ sale_price: 'abc' }], [{}]])('rejects invalid body %j with 400 and stores nothing', async (body) => {
    as(UserRole.ADMIN);
    const res = await run(PATCH, req('PATCH', body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'El precio de venta debe ser un número mayor o igual a 0' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects a commercial who did not create the project and stores nothing', async () => {
    as(UserRole.COMERCIAL);
    mockAccess.mockResolvedValue(false);
    const res = await run(PATCH, req('PATCH', { sale_price: 10 }));
    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when the project does not exist', async () => {
    as(UserRole.ADMIN);
    mockUpdate.mockResolvedValue(false);
    const res = await run(PATCH, req('PATCH', { sale_price: 10 }));
    expect(res.status).toBe(404);
  });
});
