// Mock Turso DB before any imports
jest.mock('@/lib/db', () => ({
  turso: {
    execute: jest.fn(),
  },
}));

import { turso } from '@/lib/db';
import {
  getManagerByEmail,
  getManagerById,
  getManagersByClientId,
  createManager,
  updateManager,
  getManagersWithPagination,
} from '@/lib/queries/managers';
import { revalidatePath } from 'next/cache';

const mockExecute = turso.execute as jest.MockedFunction<typeof turso.execute>;

function makeResult(rows: Record<string, unknown>[], lastInsertRowid: number | bigint = 0) {
  return {
    rows: rows as never,
    columns: [] as string[],
    columnTypes: [] as string[],
    lastInsertRowid: BigInt(lastInsertRowid),
    rowsAffected: rows.length,
    toJSON: () => ({}),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getManagerByEmail()', () => {
  it('returns the first row as ManagerType when a result is found', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([
      { id: 1, client_id: 2, name: 'Carlos', email: 'carlos@test.com', phone: '123' },
    ]));
    const result = await getManagerByEmail('carlos@test.com');
    expect(result).not.toBeNull();
  });

  it('returns null when no rows are found', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    const result = await getManagerByEmail('noone@test.com');
    expect(result).toBeNull();
  });

  it('returns null (does not throw) when turso throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    const result = await getManagerByEmail('test@test.com');
    expect(result).toBeNull();
  });
});

describe('getManagerById()', () => {
  it('returns null when turso returns no rows', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    const result = await getManagerById('99');
    expect(result).toBeNull();
  });

  it('maps the row to a ManagerType with nested client_info', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 1, client_id: 2, name: 'María', email: 'm@test.com', phone: '555',
      biography: '<p>Bio</p>', client_name: 'Acme', accept_business_units: 1,
      country_id: 3, country_name: 'Colombia', country_flag: 'co',
    }]));
    const result = await getManagerById('1');
    expect(result?.client_info).toBeDefined();
    expect(result?.client_info?.name).toBe('Acme');
    expect(result?.client_info?.country?.name).toBe('Colombia');
  });

  it('sets client_info to undefined when client_id is null', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 1, client_id: null, name: 'Test', email: 't@t.com', phone: '0',
      biography: '', client_name: null, accept_business_units: null,
      country_id: null, country_name: null, country_flag: null,
    }]));
    const result = await getManagerById('1');
    expect(result?.client_info).toBeUndefined();
  });

  it('sets nested country to undefined when country_id is null', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 1, client_id: 2, name: 'Test', email: 't@t.com', phone: '0',
      biography: '', client_name: 'Corp', accept_business_units: 0,
      country_id: null, country_name: null, country_flag: null,
    }]));
    const result = await getManagerById('1');
    expect(result?.client_info?.country).toBeUndefined();
  });

  it('returns null (does not throw) on failure', async () => {
    mockExecute.mockRejectedValueOnce(new Error('error'));
    const result = await getManagerById('1');
    expect(result).toBeNull();
  });
});

describe('getManagersByClientId()', () => {
  it('calls execute with WHERE client_id = ? and the correct arg', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await getManagersByClientId('5');
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('WHERE client_id = ?'),
      args: ['5'],
    }));
  });

  it('returns an empty array when turso throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('error'));
    const result = await getManagersByClientId('1');
    expect(result).toEqual([]);
  });
});

describe('createManager()', () => {
  it('calls turso.execute with INSERT SQL and 5 args', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([], 7));
    await createManager({
      client_id: 1,
      name: 'New Manager',
      email: 'nm@test.com',
      phone: '555-1234',
      biography: '<p>Bio</p>',
    });
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('INSERT INTO managers'),
      args: [1, 'New Manager', 'nm@test.com', '555-1234', '<p>Bio</p>'],
    }));
  });

  it('uses empty string for biography when it is undefined (prevents null constraint)', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([], 8));
    await createManager({
      client_id: 1,
      name: 'Manager',
      email: 'm@test.com',
      phone: '555',
      biography: undefined,
    });
    const call = (mockExecute as jest.Mock).mock.calls[0][0];
    // The 5th arg (index 4) should be '' not undefined
    expect(call.args[4]).toBe('');
  });

  it('calls revalidatePath with the client route', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([], 9));
    await createManager({
      client_id: 3,
      name: 'Manager',
      email: 'm@test.com',
      phone: '555',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/clients/3');
  });

  it('converts lastInsertRowid BigInt to Number for returned id', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([], 42));
    const result = await createManager({
      client_id: 1,
      name: 'M',
      email: 'm@m.com',
      phone: '0',
    });
    expect(result.id).toBe(42);
    expect(typeof result.id).toBe('number');
  });
});

describe('updateManager()', () => {
  it('returns null when no fields are provided', async () => {
    const result = await updateManager('1', {});
    expect(result).toBeNull();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('builds a SET clause containing only the provided fields', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([]))  // UPDATE
      .mockResolvedValueOnce(makeResult([])); // getManagerById
    await updateManager('1', { email: 'new@test.com' });
    const updateCall = mockExecute.mock.calls[0];
    expect(updateCall[0]).toEqual(expect.objectContaining({
      sql: expect.stringContaining('email = ?'),
    }));
    expect(updateCall[0]).toEqual(expect.objectContaining({
      sql: expect.not.stringContaining('phone = ?'),
    }));
  });
});

describe('getManagersWithPagination()', () => {
  it('adds LIKE search on name, email, AND phone when search is provided', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 0 }]))
      .mockResolvedValueOnce(makeResult([]));
    await getManagersWithPagination({ search: 'ana' });
    const countCall = mockExecute.mock.calls[0];
    expect(countCall[0]).toEqual(expect.objectContaining({
      args: expect.arrayContaining(['%ana%', '%ana%', '%ana%']),
    }));
  });

  it('filters by clientId when provided', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 0 }]))
      .mockResolvedValueOnce(makeResult([]));
    await getManagersWithPagination({ clientId: '5' });
    const countCall = mockExecute.mock.calls[0];
    expect(countCall[0]).toEqual(expect.objectContaining({
      args: expect.arrayContaining(['5']),
    }));
  });

  it('returns { managers: [], total: 0 } when turso throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('error'));
    const result = await getManagersWithPagination({});
    expect(result).toEqual({ managers: [], total: 0 });
  });
});
