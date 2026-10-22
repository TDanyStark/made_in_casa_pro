/**
 * @jest-environment node
 */
// S3: PATCH /api/users/[id] accepts hourly_rate instead of monthly_salary.
jest.mock('@/lib/services/api-auth', () => ({
  validateHttpMethod: jest.fn(() => ({ isValidMethod: true })),
  validateApiRole: jest.fn(async () => ({ isAuthorized: true, userRole: 1 })),
}));
jest.mock('@/lib/queries/users', () => ({
  getUserById: jest.fn(),
  getUserByEmail: jest.fn(),
  updateUser: jest.fn(),
}));
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
  mockGetUserById.mockResolvedValue({ id: 3, email: 'a@test.com', hourly_rate: null });
});

describe('PATCH /api/users/[id] hourly_rate', () => {
  it('updates hourly_rate', async () => {
    mockUpdateUser.mockResolvedValue({ id: 3, hourly_rate: 40000 });
    const res = await call({ hourly_rate: 40000 });
    expect(res.status).toBe(200);
    expect(mockUpdateUser).toHaveBeenCalledWith('3', { hourly_rate: 40000 });
    expect(await res.json()).toEqual({ id: 3, hourly_rate: 40000 });
  });

  it('rejects a negative hourly_rate with 400 and does not update', async () => {
    const res = await call({ hourly_rate: -1 });
    expect(res.status).toBe(400);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('ignores monthly_salary (no longer configurable)', async () => {
    const res = await call({ monthly_salary: 5000000 });
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
