/**
 * @jest-environment node
 */
// S11: PATCH /api/users/[id] accepts monthly_salary again; hourly_rate is gone.
jest.mock('@/lib/services/api-auth', () => ({
  validateHttpMethod: jest.fn(() => ({ isValidMethod: true })),
  validateApiRole: jest.fn(async () => ({ isAuthorized: true, userRole: 1 })),
}));
jest.mock('@/lib/queries/users', () => {
  const findUserById = jest.fn();
  return { getUserById: findUserById, findUserById, getUserByEmail: jest.fn(), updateUser: jest.fn() };
});
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('bcrypt', () => ({ hash: jest.fn() }));

import { NextRequest } from 'next/server';
import { PATCH } from '@/api/users/[id]/route';
import { getUserById, updateUser } from '@/lib/queries/users';

const mockGetUserById = getUserById as jest.Mock;
const mockUpdateUser = updateUser as jest.Mock;

function patchReq(body: unknown) {
  return new NextRequest('http://localhost/api/users/3', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function call(body: unknown) {
  const res = await PATCH(patchReq(body), { params: Promise.resolve({ id: '3' }) });
  if (!res) throw new Error('PATCH returned undefined');
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserById.mockResolvedValue({ id: 3, email: 'a@test.com', monthly_salary: null });
});

describe('PATCH /api/users/[id] monthly_salary', () => {
  it('updates monthly_salary', async () => {
    mockUpdateUser.mockResolvedValue({ id: 3, monthly_salary: 5040000 });
    const res = await call({ monthly_salary: 5040000 });
    expect(res.status).toBe(200);
    expect(mockUpdateUser).toHaveBeenCalledWith('3', { monthly_salary: 5040000 });
    expect(await res.json()).toEqual({ id: 3, monthly_salary: 5040000 });
  });

  it('accepts monthly_salary 0', async () => {
    mockUpdateUser.mockResolvedValue({ id: 3, monthly_salary: 0 });
    const res = await call({ monthly_salary: 0 });
    expect(res.status).toBe(200);
    expect(mockUpdateUser).toHaveBeenCalledWith('3', { monthly_salary: 0 });
  });

  it('rejects a negative monthly_salary with 400 and does not update', async () => {
    const res = await call({ monthly_salary: -1 });
    expect(res.status).toBe(400);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('ignores hourly_rate (no longer configurable)', async () => {
    const res = await call({ hourly_rate: 40000 });
    expect(res.status).toBe(200);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('keeps updating other fields as before', async () => {
    mockUpdateUser.mockResolvedValue({ id: 3, name: 'Ana' });
    const res = await call({ name: 'Ana' });
    expect(res.status).toBe(200);
    expect(mockUpdateUser).toHaveBeenCalledWith('3', { name: 'Ana' });
  });
});
