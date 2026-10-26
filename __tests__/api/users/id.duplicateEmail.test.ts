/**
 * @jest-environment node
 */
// S32 (bug review round 2): a duplicate email on user update answers 409 with
// the same message as the route's own duplicate pre-check, not a 500.
jest.mock('@/lib/services/api-auth', () => ({
  validateHttpMethod: jest.fn(() => ({ isValidMethod: true })),
  validateApiRole: jest.fn(async () => ({ isAuthorized: true, userRole: 1 })),
}));
jest.mock('@/lib/queries/users', () => {
  class UserEmailTakenError extends Error {
    name = 'UserEmailTakenError';
  }
  return {
    UserEmailTakenError,
    findUserById: jest.fn(),
    getUserByEmail: jest.fn(),
    updateUser: jest.fn(),
  };
});
jest.mock('bcrypt', () => ({ hash: jest.fn(async () => 'new-hash') }));

import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { PATCH } from '@/api/users/[id]/route';
import { findUserById, getUserByEmail, updateUser } from '@/lib/queries/users';

const { UserEmailTakenError } = jest.requireMock('@/lib/queries/users') as {
  UserEmailTakenError: new (message: string) => Error;
};
const mockFind = findUserById as jest.Mock;
const mockByEmail = getUserByEmail as jest.Mock;
const mockUpdate = updateUser as jest.Mock;
const ctx = { params: Promise.resolve({ id: '3' }) };

function patchReq(body: unknown) {
  return new NextRequest('http://localhost/api/users/3', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFind.mockResolvedValue({ id: 3, email: 'a@test.com', name: 'A', password: 'hash' });
  mockByEmail.mockResolvedValue([]);
});

describe('PATCH /api/users/[id] duplicate email (S32)', () => {
  it('returns 409 when the database rejects the email as duplicated (race after the pre-check)', async () => {
    mockUpdate.mockRejectedValue(new UserEmailTakenError('El correo electrónico ya está en uso'));

    const res = await PATCH(patchReq({ email: 'b@test.com' }), ctx);

    expect(res!.status).toBe(409);
    expect(await res!.json()).toEqual({ error: 'El correo electrónico ya está en uso' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('keeps the 409 pre-check when another user already has the email (previous behavior)', async () => {
    mockByEmail.mockResolvedValue([{ id: 8, email: 'b@test.com' }]);

    const res = await PATCH(patchReq({ email: 'b@test.com' }), ctx);

    expect(res!.status).toBe(409);
    expect(await res!.json()).toEqual({ error: 'El correo electrónico ya está en uso' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('keeps answering 500 with a generic message for other update errors (previous behavior)', async () => {
    mockUpdate.mockRejectedValue(new Error('No se pudo actualizar el usuario'));

    const res = await PATCH(patchReq({ name: 'B' }), ctx);

    expect(res!.status).toBe(500);
    expect(await res!.json()).toEqual({ error: 'Error al actualizar el usuario' });
  });
});
