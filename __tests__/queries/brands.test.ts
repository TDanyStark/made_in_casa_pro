// Mock transaction object
const mockTransaction = {
  execute: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
};

// Mock Turso DB (with transaction support) before any imports
jest.mock('@/lib/db', () => ({
  turso: {
    execute: jest.fn(),
    transaction: jest.fn(() => Promise.resolve(mockTransaction)),
  },
}));

// Mock getManagerById from managers queries
jest.mock('@/lib/queries/managers', () => ({
  getManagerById: jest.fn(),
}));

import { turso } from '@/lib/db';
import { getManagerById } from '@/lib/queries/managers';
import {
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
  getBrandsWithPagination,
} from '@/lib/queries/brands';
import { revalidatePath } from 'next/cache';

const mockExecute = turso.execute as jest.MockedFunction<typeof turso.execute>;
const mockGetManagerById = getManagerById as jest.MockedFunction<typeof getManagerById>;

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
  mockTransaction.execute.mockReset();
  mockTransaction.commit.mockReset();
  mockTransaction.rollback.mockReset();
});

describe('getBrands()', () => {
  it('returns an empty array when turso throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    const result = await getBrands();
    expect(result).toEqual([]);
  });

  it('returns rows cast to BrandType[]', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([
      { id: 1, name: 'Nike', manager_id: 10, business_unit_id: null },
    ]));
    const result = await getBrands();
    expect(result).toHaveLength(1);
  });
});

describe('getBrandById()', () => {
  it('returns null when turso returns no rows', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    const result = await getBrandById('99');
    expect(result).toBeNull();
  });

  it('maps the flat row into a nested BrandType with manager and client_info', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 5, name: 'Adidas', manager_id: 10, business_unit_id: null,
      manager_name: 'Carlos', manager_email: 'c@test.com', manager_phone: '555',
      client_id: 2, client_name: 'Acme', accept_business_units: 0,
      country_id: 1, country_name: 'Colombia', country_flag: 'co',
    }]));
    const result = await getBrandById('5');
    expect(result?.name).toBe('Adidas');
    expect(result?.manager?.name).toBe('Carlos');
    expect(result?.manager?.client_info?.name).toBe('Acme');
  });

  it('sets country to undefined when country_id is null', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 5, name: 'Brand', manager_id: 10, business_unit_id: null,
      manager_name: 'M', manager_email: 'm@m.com', manager_phone: '0',
      client_id: 2, client_name: 'Corp', accept_business_units: 0,
      country_id: null, country_name: null, country_flag: null,
    }]));
    const result = await getBrandById('5');
    expect(result?.manager?.client_info?.country).toBeUndefined();
  });

  it('returns null (does not throw) on failure', async () => {
    mockExecute.mockRejectedValueOnce(new Error('error'));
    const result = await getBrandById('1');
    expect(result).toBeNull();
  });
});

describe('createBrand()', () => {
  it('calls turso.execute with INSERT SQL and correct args', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([], 15));
    mockGetManagerById.mockResolvedValueOnce({
      id: 10, client_id: 2, name: 'Carlos', email: 'c@test.com', phone: '555',
    });
    await createBrand({ name: 'New Brand', manager_id: 10 });
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('INSERT INTO brands'),
      args: ['New Brand', 10, null],
    }));
  });

  it('uses null for business_unit_id when it is undefined', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([], 15));
    mockGetManagerById.mockResolvedValueOnce({
      id: 10, client_id: 2, name: 'M', email: 'm@m.com', phone: '0',
    });
    await createBrand({ name: 'Brand', manager_id: 10, business_unit_id: undefined });
    const call = (mockExecute as jest.Mock).mock.calls[0][0];
    expect(call.args[2]).toBeNull();
  });

  it('calls revalidatePath when manager has a client_id', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([], 15));
    mockGetManagerById.mockResolvedValueOnce({
      id: 10, client_id: 3, name: 'Manager', email: 'm@m.com', phone: '0',
    });
    await createBrand({ name: 'Brand', manager_id: 10 });
    expect(revalidatePath).toHaveBeenCalledWith('/clients/3');
  });

  it('returns the new brand with id from lastInsertRowid', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([], 20));
    mockGetManagerById.mockResolvedValueOnce({
      id: 10, client_id: 2, name: 'M', email: 'm@m.com', phone: '0',
    });
    const result = await createBrand({ name: 'Brand', manager_id: 10 });
    expect(result.id).toBe(20);
  });
});

describe('updateBrand()', () => {
  it('opens a transaction when updates are provided', async () => {
    // First getBrandById call (to get current brand)
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 5, name: 'Old', manager_id: 10, business_unit_id: null,
      manager_name: 'M', manager_email: 'm@m.com', manager_phone: '0',
      client_id: 2, client_name: 'Corp', accept_business_units: 0,
      country_id: null, country_name: null, country_flag: null,
    }]));
    mockTransaction.execute.mockResolvedValue(makeResult([]));
    mockTransaction.commit.mockResolvedValue(undefined);
    // getBrandById after update
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 5, name: 'Old', manager_id: 20, business_unit_id: null,
      manager_name: 'New', manager_email: 'new@m.com', manager_phone: '0',
      client_id: 2, client_name: 'Corp', accept_business_units: 0,
      country_id: null, country_name: null, country_flag: null,
    }]));

    await updateBrand('5', { manager_id: 20 });
    expect(turso.transaction).toHaveBeenCalledWith('write');
  });

  it('inserts a history record when manager_id changes from current value', async () => {
    // Current brand has manager_id 10
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 5, name: 'Brand', manager_id: 10, business_unit_id: null,
      manager_name: 'M', manager_email: 'm@m.com', manager_phone: '0',
      client_id: 2, client_name: 'Corp', accept_business_units: 0,
      country_id: null, country_name: null, country_flag: null,
    }]));
    mockTransaction.execute.mockResolvedValue(makeResult([]));
    mockTransaction.commit.mockResolvedValue(undefined);
    // getBrandById after update
    mockExecute.mockResolvedValueOnce(makeResult([]));

    await updateBrand('5', { manager_id: 20 }); // new manager is 20
    // Should have called transaction.execute twice: once for UPDATE, once for history INSERT
    expect(mockTransaction.execute).toHaveBeenCalledTimes(2);
    expect(mockTransaction.execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('brand_manager_history'),
    }));
  });

  it('does NOT insert history when manager_id is the same as current', async () => {
    // Current brand already has manager_id 10
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 5, name: 'Brand', manager_id: 10, business_unit_id: null,
      manager_name: 'M', manager_email: 'm@m.com', manager_phone: '0',
      client_id: 2, client_name: 'Corp', accept_business_units: 0,
      country_id: null, country_name: null, country_flag: null,
    }]));
    mockTransaction.execute.mockResolvedValue(makeResult([]));
    mockTransaction.commit.mockResolvedValue(undefined);
    mockExecute.mockResolvedValueOnce(makeResult([]));

    await updateBrand('5', { manager_id: 10 }); // same manager
    // Only the UPDATE call, no history insert
    expect(mockTransaction.execute).toHaveBeenCalledTimes(1);
  });

  it('commits the transaction on success', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 5, name: 'Brand', manager_id: 10, business_unit_id: null,
      manager_name: 'M', manager_email: 'm@m.com', manager_phone: '0',
      client_id: 2, client_name: 'Corp', accept_business_units: 0,
      country_id: null, country_name: null, country_flag: null,
    }]));
    mockTransaction.execute.mockResolvedValue(makeResult([]));
    mockTransaction.commit.mockResolvedValue(undefined);
    mockExecute.mockResolvedValueOnce(makeResult([]));

    await updateBrand('5', { manager_id: 20 });
    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  it('rolls back the transaction on transaction.execute error', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 5, name: 'Brand', manager_id: 10, business_unit_id: null,
      manager_name: 'M', manager_email: 'm@m.com', manager_phone: '0',
      client_id: 2, client_name: 'Corp', accept_business_units: 0,
      country_id: null, country_name: null, country_flag: null,
    }]));
    mockTransaction.execute.mockRejectedValueOnce(new Error('TX error'));
    mockTransaction.rollback.mockResolvedValue(undefined);

    await expect(updateBrand('5', { manager_id: 20 })).rejects.toThrow('TX error');
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });

  it('returns getBrandById result without transaction when no updates are provided', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await updateBrand('5', {});
    expect(turso.transaction).not.toHaveBeenCalled();
  });
});

describe('getBrandsWithPagination()', () => {
  it('returns { brands: [], total: 0 } when turso throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('error'));
    const result = await getBrandsWithPagination({});
    expect(result).toEqual({ brands: [], total: 0 });
  });

  it('filters by clientId when provided', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 0 }]))
      .mockResolvedValueOnce(makeResult([]));
    await getBrandsWithPagination({ clientId: '3' });
    const countCall = mockExecute.mock.calls[0];
    expect(countCall[0]).toEqual(expect.objectContaining({
      args: expect.arrayContaining(['3']),
    }));
  });
});
