/**
 * @jest-environment node
 */
// S8: /api/users/[id] never returns the password hash, returns 404 for a missing
// user and never leaks internal error text.
jest.mock('@/lib/services/api-auth', () => ({
  validateHttpMethod: jest.fn(() => ({ isValidMethod: true })),
  validateApiRole: jest.fn(async () => ({ isAuthorized: true, userRole: 1 })),
}));
jest.mock('@/lib/queries/users', () => ({
  findUserById: jest.fn(),
  getUserByEmail: jest.fn(),
  updateUser: jest.fn(),
}));
jest.mock('bcrypt', () => ({ hash: jest.fn(async () => 'new-hash') }));

import { NextRequest } from 'next/server';
import { GET, PATCH } from '@/api/users/[id]/route';
import { findUserById, updateUser } from '@/lib/queries/users';

const mockFind = findUserById as jest.Mock;
const mockUpdate = updateUser as jest.Mock;
const ctx = { params: Promise.resolve({ id: '3' }) };

function patchReq(body: unknown) {
  return new NextRequest('http://localhost/api/users/3', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
const getReq = () => new NextRequest('http://localhost/api/users/3');

beforeEach(() => {
  jest.clearAllMocks();
  mockFind.mockResolvedValue({ id: 3, email: 'a@test.com', name: 'A', password: 'old-hash' });
});

describe('PATCH /api/users/[id]', () => {
  it('does not return the password hash after an update', async () => {
    mockUpdate.mockResolvedValue({ id: 3, name: 'B', email: 'a@test.com', password: 'new-hash' });

    const res = await PATCH(patchReq({ name: 'B', password: 'secret12' }), ctx);

    expect(res!.status).toBe(200);
    expect(await res!.json()).toEqual({ id: 3, name: 'B', email: 'a@test.com' });
  });

  it('does not return the password hash when there is nothing to update', async () => {
    const res = await PATCH(patchReq({}), ctx);

    expect(res!.status).toBe(200);
    expect(await res!.json()).toEqual({ id: 3, email: 'a@test.com', name: 'A' });
  });

  it('returns 404 and does not update when the user does not exist', async () => {
    mockFind.mockResolvedValue(null);

    const res = await PATCH(patchReq({ name: 'B' }), ctx);

    expect(res!.status).toBe(404);
    expect(await res!.json()).toEqual({ error: 'Usuario no encontrado' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns a generic 500 without internal error text', async () => {
    mockUpdate.mockRejectedValue(new Error('duplicate key value violates constraint users_pkey'));

    const res = await PATCH(patchReq({ name: 'B' }), ctx);

    expect(res!.status).toBe(500);
    expect(await res!.json()).toEqual({ error: 'Error al actualizar el usuario' });
  });
});

describe('GET /api/users/[id]', () => {
  it('returns the user without the password (previous behavior)', async () => {
    const res = await GET(getReq(), ctx);

    expect(res!.status).toBe(200);
    expect(await res!.json()).toEqual({ id: 3, email: 'a@test.com', name: 'A' });
  });

  it('returns 404 when the user does not exist', async () => {
    mockFind.mockResolvedValue(null);

    const res = await GET(getReq(), ctx);

    expect(res!.status).toBe(404);
    expect(await res!.json()).toEqual({ error: 'Usuario no encontrado' });
  });

  it('returns a generic 500 without internal error text', async () => {
    mockFind.mockRejectedValue(new Error('connection refused 10.0.0.1'));

    const res = await GET(getReq(), ctx);

    expect(res!.status).toBe(500);
    expect(await res!.json()).toEqual({ error: 'Error al obtener el usuario' });
  });
});
