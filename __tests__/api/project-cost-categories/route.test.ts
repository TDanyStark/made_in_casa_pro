/**
 * @jest-environment node
 */
// Spec: odd/tasks/project-costs.md — S2, S6: GET and POST /api/project-cost-categories.
jest.mock('@/lib/services/api-auth', () => ({
  validateHttpMethod: jest.fn(() => ({ isValidMethod: true })),
  validateApiRole: jest.fn(),
}));
jest.mock('@/lib/queries/projectCosts', () => ({
  listCostCategories: jest.fn(),
  createCostCategory: jest.fn(),
}));
jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: 'c' }) })),
}));
jest.mock('@/lib/session', () => ({
  decrypt: jest.fn(async () => ({ id: 77, rol_id: 3 })),
}));

import { NextRequest, NextResponse } from 'next/server';
import { GET, POST } from '@/api/project-cost-categories/route';
import { validateApiRole } from '@/lib/services/api-auth';
import { listCostCategories, createCostCategory } from '@/lib/queries/projectCosts';
import { UserRole } from '@/lib/definitions';

const mockRole = validateApiRole as jest.Mock;
const mockList = listCostCategories as jest.Mock;
const mockCreate = createCostCategory as jest.Mock;
const PROJECT_COSTS_ROLES = [UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.FINANCIERO, UserRole.COMERCIAL];
const category = { id: 9, name: 'Higgsfield', created_by: 77, created_at: 'x' };

function as(role: UserRole) {
  mockRole.mockResolvedValue({ isAuthorized: true, userRole: role });
}
function req(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/project-cost-categories', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function run(h: (r: NextRequest) => Promise<Response | undefined>, r: NextRequest) {
  const res = await h(r);
  if (!res) throw new Error("handler returned undefined");
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockList.mockResolvedValue([category]);
  mockCreate.mockResolvedValue({ created: true, category });
});

describe('GET /api/project-cost-categories', () => {
  it('lists the categories to the project cost roles', async () => {
    as(UserRole.COMERCIAL);
    const res = await run(GET, req('GET'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [category] });
    expect(mockRole.mock.calls[0][1]).toEqual(PROJECT_COSTS_ROLES);
  });

  it('returns the role rejection (colaborador) unchanged', async () => {
    mockRole.mockResolvedValue({ isAuthorized: false, response: NextResponse.json({ error: 'x' }, { status: 403 }) });
    const res = await run(GET, req('GET'));
    expect(res.status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });
});

describe('POST /api/project-cost-categories', () => {
  it('creates a trimmed category with the session user and returns 201', async () => {
    as(UserRole.FINANCIERO);
    const res = await run(POST, req('POST', { name: '  Higgsfield ' }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(category);
    expect(mockRole.mock.calls[0][1]).toEqual(PROJECT_COSTS_ROLES);
    expect(mockCreate).toHaveBeenCalledWith('Higgsfield', 77);
  });

  it('returns the existing category with 200 on a case-insensitive duplicate', async () => {
    as(UserRole.COMERCIAL);
    const existing = { id: 3, name: 'Otro', created_by: null, created_at: 'x' };
    mockCreate.mockResolvedValue({ created: false, category: existing });
    const res = await run(POST, req('POST', { name: 'OTRO' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(existing);
  });

  it.each([[{ name: '   ' }], [{}], [{ name: 5 }]])('rejects %j with 400 and creates nothing', async (body) => {
    as(UserRole.ADMIN);
    const res = await run(POST, req('POST', body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'El nombre de la categoría es obligatorio' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects a name longer than 80 characters', async () => {
    as(UserRole.ADMIN);
    const res = await run(POST, req('POST', { name: 'a'.repeat(81) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'El nombre de la categoría es demasiado largo' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns the role rejection (colaborador) unchanged and creates nothing', async () => {
    mockRole.mockResolvedValue({ isAuthorized: false, response: NextResponse.json({ error: 'x' }, { status: 403 }) });
    const res = await run(POST, req('POST', { name: 'Nueva' }));
    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
