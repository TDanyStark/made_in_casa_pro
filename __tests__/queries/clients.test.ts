// Mock Turso DB before any imports
jest.mock('@/lib/db', () => ({
  turso: {
    execute: jest.fn(),
  },
}));

import { turso } from '@/lib/db';
import {
  getClients,
  createClient,
  fetchFilteredClients,
  getClientById,
  getClientsWithPagination,
  updateClient,
} from '@/lib/queries/clients';
import { revalidatePath } from 'next/cache';

const mockExecute = turso.execute as jest.MockedFunction<typeof turso.execute>;

// Helper for a Turso-like result object
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

describe('getClients()', () => {
  it('calls turso.execute with SELECT * FROM clients', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await getClients();
    expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM clients');
  });

  it('throws a wrapped error when turso.execute rejects', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    await expect(getClients()).rejects.toThrow('No se pudieron obtener los clientes');
  });
});

describe('createClient()', () => {
  it('calls turso.execute with INSERT SQL and correct args', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([], 5));
    await createClient('Test Client', 1);
    expect(mockExecute).toHaveBeenCalledWith({
      sql: expect.stringContaining('INSERT INTO clients'),
      args: ['Test Client', 1],
    });
  });

  it('re-throws errors from turso', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    await expect(createClient('Bad', 1)).rejects.toThrow();
  });
});

describe('fetchFilteredClients()', () => {
  it('returns an empty array when turso returns no rows', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    const result = await fetchFilteredClients();
    expect(result).toEqual([]);
  });

  it('maps a row with country data to a ClientType with nested country', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([
      { id: 1, name: 'Acme', country_id: 2, country_name: 'Colombia', country_flag: 'co' },
    ]));
    const result = await fetchFilteredClients();
    expect(result[0]).toEqual({
      id: 1,
      name: 'Acme',
      country: { id: 2, name: 'Colombia', flag: 'co' },
    });
  });

  it('maps a row without country_id to a ClientType where country is undefined', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([
      { id: 3, name: 'No Country', country_id: null, country_name: null, country_flag: null },
    ]));
    const result = await fetchFilteredClients();
    expect(result[0].country).toBeUndefined();
  });

  it('coerces id to Number and name to String', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([
      { id: '10', name: 123, country_id: null },
    ]));
    const result = await fetchFilteredClients();
    expect(typeof result[0].id).toBe('number');
    expect(typeof result[0].name).toBe('string');
  });
});

describe('getClientById()', () => {
  it('returns null when turso returns no rows', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    const result = await getClientById('99');
    expect(result).toBeNull();
  });

  it('returns a ClientType with the correct fields', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([
      { id: 1, name: 'Acme Corp', country_id: 2, country_name: 'Colombia', accept_business_units: 1, country_flag: 'co' },
    ]));
    const result = await getClientById('1');
    expect(result).not.toBeNull();
    expect(result?.name).toBe('Acme Corp');
  });

  it('includes a nested country when country_id is present', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([
      { id: 1, name: 'Acme', country_id: 2, country_name: 'Colombia', accept_business_units: 0, country_flag: 'co' },
    ]));
    const result = await getClientById('1');
    expect(result?.country).toBeDefined();
    expect(result?.country?.name).toBe('Colombia');
  });

  it('sets country to undefined when country_id is null', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([
      { id: 1, name: 'Acme', country_id: null, accept_business_units: 0 },
    ]));
    const result = await getClientById('1');
    expect(result?.country).toBeUndefined();
  });

  it('coerces accept_business_units to Boolean', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([
      { id: 1, name: 'Test', country_id: null, accept_business_units: 1 },
    ]));
    const result = await getClientById('1');
    expect(result?.accept_business_units).toBe(true);
  });
});

describe('getClientsWithPagination()', () => {
  it('returns { clients: [], total: 0 } when turso throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    const result = await getClientsWithPagination({});
    expect(result).toEqual({ clients: [], total: 0 });
  });

  it('calculates OFFSET as (page - 1) * limit for page 2', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 25 }]))
      .mockResolvedValueOnce(makeResult([]));
    await getClientsWithPagination({ page: 2, limit: 10 });
    // Second call should have OFFSET = 10 in its args
    const secondCall = mockExecute.mock.calls[1];
    expect(secondCall[0]).toEqual(expect.objectContaining({
      args: expect.arrayContaining([10, 10]), // limit=10, offset=10
    }));
  });

  it('adds LIKE search conditions when search is provided', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 0 }]))
      .mockResolvedValueOnce(makeResult([]));
    await getClientsWithPagination({ search: 'acme' });
    const firstCall = mockExecute.mock.calls[0];
    expect(firstCall[0]).toEqual(expect.objectContaining({
      args: expect.arrayContaining(['%acme%']),
    }));
  });

  it('extracts total from the count query result', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 42 }]))
      .mockResolvedValueOnce(makeResult([]));
    const result = await getClientsWithPagination({});
    expect(result.total).toBe(42);
  });
});

describe('updateClient()', () => {
  it('returns null when updateData has no recognized fields', async () => {
    const result = await updateClient('1', {});
    expect(result).toBeNull();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('constructs SET clause with only the provided field', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([])) // UPDATE
      .mockResolvedValueOnce(makeResult([{ id: 1, name: 'Updated', country_id: null, accept_business_units: 0 }])); // getClientById
    await updateClient('1', { name: 'Updated' });
    const updateCall = mockExecute.mock.calls[0];
    expect(updateCall[0]).toEqual(expect.objectContaining({
      sql: expect.stringContaining('name = ?'),
    }));
  });

  it('converts accept_business_units: true to 1 in SQL args', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([{ id: 1, name: 'T', country_id: null, accept_business_units: 1 }]));
    await updateClient('1', { accept_business_units: true });
    const updateCall = mockExecute.mock.calls[0];
    expect(updateCall[0]).toEqual(expect.objectContaining({
      args: expect.arrayContaining([1]),
    }));
  });

  it('converts accept_business_units: false to 0 in SQL args', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([{ id: 1, name: 'T', country_id: null, accept_business_units: 0 }]));
    await updateClient('1', { accept_business_units: false });
    const updateCall = mockExecute.mock.calls[0];
    expect(updateCall[0]).toEqual(expect.objectContaining({
      args: expect.arrayContaining([0]),
    }));
  });

  it('calls revalidatePath with the client route', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([{ id: 1, name: 'T', country_id: null, accept_business_units: 0 }]));
    await updateClient('1', { name: 'Test' });
    expect(revalidatePath).toHaveBeenCalledWith('/clients/1');
  });
});
