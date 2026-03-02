// Mock Turso DB before any imports
jest.mock('@/lib/db', () => ({
  turso: {
    execute: jest.fn(),
  },
}));

import { turso } from '@/lib/db';
import {
  getUsers,
  getUserById,
  getUserByEmail,
  createUser,
  deleteUser,
  updateUser,
} from '@/lib/queries/users';

const mockExecute = turso.execute as jest.MockedFunction<typeof turso.execute>;

function makeResult(rows: Record<string, unknown>[], lastInsertRowid = 0n) {
  return {
    rows: rows as never,
    columns: [],
    lastInsertRowid: BigInt(lastInsertRowid),
    rowsAffected: rows.length,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getUserById()', () => {
  it('returns a mapped user object for a found user', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 1, name: 'Juan', email: 'juan@test.com', password: 'hash',
      rol_id: 4, area_id: null, is_internal: 1, is_active: 1,
      monthly_salary: null, must_change_password: 0,
      last_login: null, created_at: '2024-01-01',
    }]));
    const result = await getUserById(1);
    expect(result.name).toBe('Juan');
    expect(result.email).toBe('juan@test.com');
  });

  it('coerces is_internal, is_active, must_change_password to Boolean', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 1, name: 'Test', email: 't@t.com', password: '', rol_id: 1,
      area_id: null, is_internal: 1, is_active: 0,
      monthly_salary: null, must_change_password: 1, last_login: null, created_at: null,
    }]));
    const result = await getUserById(1);
    expect(result.is_internal).toBe(true);
    expect(result.is_active).toBe(false);
    expect(result.must_change_password).toBe(true);
  });

  it('throws "No se pudo obtener el usuario" when user is not found', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await expect(getUserById(999)).rejects.toThrow('No se pudo obtener el usuario');
  });
});

describe('getUserByEmail()', () => {
  it('returns an array of UserType for found users', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([
      { id: 1, name: 'Ana', email: 'ana@test.com', password: 'hash', rol_id: 1 },
    ]));
    const result = await getUserByEmail('ana@test.com');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].email).toBe('ana@test.com');
  });

  it('returns an empty array when no users match', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    const result = await getUserByEmail('noone@test.com');
    expect(result).toEqual([]);
  });
});

describe('createUser()', () => {
  it('calls turso.execute with INSERT INTO users and 4 args', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([], 10));
    await createUser('Maria', 'maria@test.com', 'hashedpw', 3);
    expect(mockExecute).toHaveBeenCalledWith({
      sql: expect.stringContaining('INSERT INTO users'),
      args: ['Maria', 'maria@test.com', 'hashedpw', 3],
    });
  });

  it('throws "No se pudo crear el usuario" when turso fails', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    await expect(createUser('X', 'x@x.com', 'pw', 1)).rejects.toThrow('No se pudo crear el usuario');
  });
});

describe('deleteUser()', () => {
  it('calls turso.execute with DELETE WHERE id = ? and the userId', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await deleteUser(5);
    expect(mockExecute).toHaveBeenCalledWith({
      sql: expect.stringContaining('DELETE FROM users WHERE id = ?'),
      args: [5],
    });
  });

  it('throws when turso fails', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    await expect(deleteUser(1)).rejects.toThrow('No se pudo eliminar el usuario');
  });
});

describe('getUsers()', () => {
  it('uses page=1 and pageSize=10 as defaults', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ total: 0 }]))  // count query
      .mockResolvedValueOnce(makeResult([]));             // data query
    await getUsers();
    const dataCall = mockExecute.mock.calls[1];
    // OFFSET should be 0 (page 1, size 10 → offset = 0)
    expect(dataCall[0]).toEqual(expect.objectContaining({
      args: expect.arrayContaining([10, 0]),
    }));
  });

  it('calculates OFFSET correctly for page 3 with pageSize 10', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ total: 50 }]))
      .mockResolvedValueOnce(makeResult([]));
    await getUsers({ page: 3, pageSize: 10 });
    const dataCall = mockExecute.mock.calls[1];
    expect(dataCall[0]).toEqual(expect.objectContaining({
      args: expect.arrayContaining([10, 20]), // LIMIT 10, OFFSET 20
    }));
  });

  it('calculates pageCount correctly — total 25 with pageSize 10 gives 3', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ total: 25 }]))
      .mockResolvedValueOnce(makeResult([]));
    const result = await getUsers({ pageSize: 10 });
    expect(result.pageCount).toBe(3);
  });

  it('adds LIKE conditions for name AND email when search is provided', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ total: 0 }]))
      .mockResolvedValueOnce(makeResult([]));
    await getUsers({ search: 'juan' });
    const countCall = mockExecute.mock.calls[0];
    expect(countCall[0]).toEqual(expect.objectContaining({
      args: expect.arrayContaining(['%juan%', '%juan%']),
    }));
  });

  it('throws "No se pudieron obtener los usuarios" when turso fails', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    await expect(getUsers()).rejects.toThrow('No se pudieron obtener los usuarios');
  });
});

describe('updateUser()', () => {
  it('throws "No se proporcionaron campos para actualizar" when data is empty', async () => {
    await expect(updateUser('1', {})).rejects.toThrow('No se pudo actualizar el usuario');
  });

  it('builds a SET clause containing only the provided fields', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([]))  // UPDATE
      .mockResolvedValueOnce(makeResult([{   // SELECT after update
        id: 1, name: 'Updated', email: 'u@test.com', password: '', rol_id: 1,
        area_id: null, is_internal: 0, is_active: 1, monthly_salary: null,
        must_change_password: 0, last_login: null, created_at: null,
      }]));
    await updateUser('1', { name: 'Updated' });
    const updateCall = mockExecute.mock.calls[0];
    expect(updateCall[0]).toEqual(expect.objectContaining({
      sql: expect.stringContaining('name = ?'),
    }));
    // Should NOT include email in SET
    expect(updateCall[0]).toEqual(expect.objectContaining({
      sql: expect.not.stringContaining('email = ?'),
    }));
  });

  it('returns the updated user row after a successful update', async () => {
    const updatedRow = {
      id: 1, name: 'New Name', email: 'u@test.com', password: '', rol_id: 1,
      area_id: null, is_internal: 0, is_active: 1, monthly_salary: null,
      must_change_password: 0, last_login: null, created_at: null,
    };
    mockExecute
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([updatedRow]));
    const result = await updateUser('1', { name: 'New Name' });
    expect(result).toEqual(updatedRow);
  });
});
