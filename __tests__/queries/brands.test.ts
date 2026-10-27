// Mock transaction object
const mockTransaction = {
  execute: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
};

// Mock DB (with transaction support) before any imports
jest.mock('@/lib/db', () => ({
  db: {
    execute: jest.fn(),
    transaction: jest.fn(() => Promise.resolve(mockTransaction)),
  },
}));

// Mock getManagerById from managers queries
jest.mock('@/lib/queries/managers', () => ({
  getManagerById: jest.fn(),
}));

import { db } from '@/lib/db';
import { getManagerById } from '@/lib/queries/managers';
import {
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
  getBrandsWithPagination,
} from '@/lib/queries/brands';
import { revalidatePath } from 'next/cache';

const mockExecute = db.execute as jest.MockedFunction<typeof db.execute>;
const mockGetManagerById = getManagerById as jest.MockedFunction<typeof getManagerById>;

function makeResult(rows: Record<string, unknown>[]) {
  return {
    rows: rows as never,
    columns: [] as string[],
    columnTypes: [] as string[],
    rowsAffected: rows.length,
    toJSON: () => ({}),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.execute.mockReset();
  mockTransaction.commit.mockReset();
  mockTransaction.rollback.mockReset();
});

describe('getBrands()', () => {
  it('returns an empty array when db throws', async () => {
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
  it('returns null when db returns no rows', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    const result = await getBrandById('99');
    expect(result).toBeNull();
  });

  it('maps the flat row into a nested BrandType with manager and client_info', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 5, name: 'Adidas', manager_id: 10, business_unit_id: null,
      manager_name: 'Carlos', manager_email: 'c@test.com', manager_phone: '555',
      manager_client_id: 2,
      client_id: 2, client_name: 'Acme', accept_business_units: 0,
      country_id: 1, country_name: 'Colombia', country_flag: 'co',
    }]));
    const result = await getBrandById('5');
    expect(result?.name).toBe('Adidas');
    expect(result?.manager?.name).toBe('Carlos');
    expect(result?.manager?.client_info?.name).toBe('Acme');
  });

  it('resolves the client from brands.client_id, not from the manager', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await getBrandById('5');
    const call = (mockExecute as jest.Mock).mock.calls[0][0];
    expect(call.sql).toContain('JOIN clients c ON b.client_id = c.id');
    expect(call.sql).not.toContain('JOIN clients c ON m.client_id = c.id');
  });

  it('exposes client_id and client_info at the top level of the brand', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 5, name: 'Adidas', manager_id: 10, business_unit_id: null,
      manager_name: 'Carlos', manager_email: 'c@test.com', manager_phone: '555',
      manager_client_id: 7,
      client_id: 2, client_name: 'Acme', accept_business_units: 0,
      country_id: null, country_name: null, country_flag: null,
    }]));
    const result = await getBrandById('5');
    expect(result?.client_id).toBe(2);
    expect(result?.client_info?.name).toBe('Acme');
    // El gerente fue trasladado: su cliente real (7) ya no es el de la marca (2)
    expect(result?.manager?.client_id).toBe(7);
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
  it('persists client_id taken from the initial manager', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 15 }]));
    mockGetManagerById.mockResolvedValueOnce({
      id: 10, client_id: 2, name: 'Carlos', email: 'c@test.com', phone: '555',
    });
    await createBrand({ name: 'New Brand', manager_id: 10 });
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('INSERT INTO brands'),
      args: ['New Brand', 10, null, 2],
    }));
  });

  it('uses null for business_unit_id when it is undefined', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 15 }]));
    mockGetManagerById.mockResolvedValueOnce({
      id: 10, client_id: 2, name: 'M', email: 'm@m.com', phone: '0',
    });
    await createBrand({ name: 'Brand', manager_id: 10, business_unit_id: undefined });
    const call = (mockExecute as jest.Mock).mock.calls[0][0];
    expect(call.args[2]).toBeNull();
  });

  it('throws MANAGER_NOT_FOUND when the manager does not exist', async () => {
    mockGetManagerById.mockResolvedValueOnce(null);
    await expect(createBrand({ name: 'Brand', manager_id: 99 }))
      .rejects.toMatchObject({ code: 'MANAGER_NOT_FOUND' });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('calls revalidatePath with the client of the manager', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 15 }]));
    mockGetManagerById.mockResolvedValueOnce({
      id: 10, client_id: 3, name: 'Manager', email: 'm@m.com', phone: '0',
    });
    await createBrand({ name: 'Brand', manager_id: 10 });
    expect(revalidatePath).toHaveBeenCalledWith('/clients/3');
  });

  it('returns the new brand with id from RETURNING clause and its client_id', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 20 }]));
    mockGetManagerById.mockResolvedValueOnce({
      id: 10, client_id: 2, name: 'M', email: 'm@m.com', phone: '0',
    });
    const result = await createBrand({ name: 'Brand', manager_id: 10 });
    expect(result.id).toBe(20);
    expect(result.client_id).toBe(2);
  });
});

describe('updateBrand()', () => {
  /** Fila cruda de getBrandById: marca 5, gerente 10, cliente 2. */
  function currentBrandRow(overrides: Record<string, unknown> = {}) {
    return makeResult([{
      id: 5, name: 'Brand', manager_id: 10, business_unit_id: null,
      manager_name: 'M', manager_email: 'm@m.com', manager_phone: '0',
      manager_client_id: 2,
      client_id: 2, client_name: 'Corp', accept_business_units: 0,
      country_id: null, country_name: null, country_flag: null,
      ...overrides,
    }]);
  }

  /** Gerente sucesor válido: mismo cliente (2) que la marca. */
  function sameClientManager() {
    return { id: 20, client_id: 2, name: 'New', email: 'new@m.com', phone: '0' };
  }

  it('opens a transaction when updates are provided', async () => {
    mockExecute.mockResolvedValueOnce(currentBrandRow());
    mockGetManagerById.mockResolvedValueOnce(sameClientManager());
    mockTransaction.execute.mockResolvedValue(makeResult([]));
    mockTransaction.commit.mockResolvedValue(undefined);
    mockExecute.mockResolvedValueOnce(currentBrandRow({ manager_id: 20 }));

    await updateBrand('5', { manager_id: 20 });
    expect(db.transaction).toHaveBeenCalledWith('write');
  });

  it('inserts a history record with changed_by when manager_id changes', async () => {
    mockExecute.mockResolvedValueOnce(currentBrandRow());
    mockGetManagerById.mockResolvedValueOnce(sameClientManager());
    mockTransaction.execute.mockResolvedValue(makeResult([]));
    mockTransaction.commit.mockResolvedValue(undefined);
    mockExecute.mockResolvedValueOnce(makeResult([]));

    await updateBrand('5', { manager_id: 20 }, 77, 'Traslado');

    // UPDATE de la marca + historial + lectura de sus proyectos (S1)
    expect(mockTransaction.execute).toHaveBeenCalledTimes(3);
    expect(mockTransaction.execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('brand_manager_history'),
      args: ['5', 10, 20, 77, 'Traslado'],
    }));
  });

  it('uses CURRENT_TIMESTAMP instead of the old NOW() - INTERVAL hack', async () => {
    mockExecute.mockResolvedValueOnce(currentBrandRow());
    mockGetManagerById.mockResolvedValueOnce(sameClientManager());
    mockTransaction.execute.mockResolvedValue(makeResult([]));
    mockTransaction.commit.mockResolvedValue(undefined);
    mockExecute.mockResolvedValueOnce(makeResult([]));

    await updateBrand('5', { manager_id: 20 });

    const historyCall = mockTransaction.execute.mock.calls
      .map((call) => call[0] as { sql: string })
      .find((arg) => arg.sql.includes('brand_manager_history'))!;
    expect(historyCall.sql).toContain('CURRENT_TIMESTAMP');
    expect(historyCall.sql).not.toContain('INTERVAL');
  });

  it('rejects a manager from a different client and does NOT touch the brand', async () => {
    mockExecute.mockResolvedValueOnce(currentBrandRow()); // marca del cliente 2
    mockGetManagerById.mockResolvedValueOnce({
      id: 30, client_id: 99, name: 'Otro', email: 'o@m.com', phone: '0',
    });

    await expect(updateBrand('5', { manager_id: 30 }))
      .rejects.toMatchObject({ code: 'MANAGER_CLIENT_MISMATCH' });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('does NOT insert history when manager_id is the same as current', async () => {
    mockExecute.mockResolvedValueOnce(currentBrandRow());
    mockTransaction.execute.mockResolvedValue(makeResult([]));
    mockTransaction.commit.mockResolvedValue(undefined);
    mockExecute.mockResolvedValueOnce(makeResult([]));

    await updateBrand('5', { manager_id: 10 }); // same manager
    // Only the UPDATE call, no history insert
    expect(mockTransaction.execute).toHaveBeenCalledTimes(1);
    // Tampoco valida al gerente: no hay cambio que validar
    expect(mockGetManagerById).not.toHaveBeenCalled();
  });

  it('commits the transaction on success', async () => {
    mockExecute.mockResolvedValueOnce(currentBrandRow());
    mockGetManagerById.mockResolvedValueOnce(sameClientManager());
    mockTransaction.execute.mockResolvedValue(makeResult([]));
    mockTransaction.commit.mockResolvedValue(undefined);
    mockExecute.mockResolvedValueOnce(makeResult([]));

    await updateBrand('5', { manager_id: 20 });
    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  it('rolls back the transaction on transaction.execute error', async () => {
    mockExecute.mockResolvedValueOnce(currentBrandRow());
    mockGetManagerById.mockResolvedValueOnce(sameClientManager());
    mockTransaction.execute.mockRejectedValueOnce(new Error('TX error'));
    mockTransaction.rollback.mockResolvedValue(undefined);

    await expect(updateBrand('5', { manager_id: 20 })).rejects.toThrow('TX error');
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });

  it('returns getBrandById result without transaction when no updates are provided', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await updateBrand('5', {});
    expect(db.transaction).not.toHaveBeenCalled();
  });

  // ── Los proyectos siguen a su marca sin escrituras por proyecto ───────────
  // Spec: odd/tasks/brand-sourced-project-manager.md — S4

  /** Ids de los proyectos cuya marca principal es esta (lectura en la transacción). */
  function brandProjects(rows: Array<{ id: number }>) {
    mockTransaction.execute.mockImplementation(async (stmt: { sql: string }) =>
      /FROM projects/.test(stmt.sql) ? makeResult(rows) : makeResult([])
    );
  }

  function txCalls() {
    return mockTransaction.execute.mock.calls.map(
      (call) => call[0] as { sql: string; args: unknown[] }
    );
  }

  it('S4: cambia el gerente de la marca con historial y solo LEE sus proyectos, sin escribirlos', async () => {
    mockExecute.mockResolvedValueOnce(currentBrandRow());
    mockGetManagerById.mockResolvedValueOnce(sameClientManager());
    brandProjects([{ id: 20 }, { id: 21 }]);
    mockTransaction.commit.mockResolvedValue(undefined);
    mockExecute.mockResolvedValueOnce(currentBrandRow({ manager_id: 20 }));

    const result = await updateBrand('5', { manager_id: 20 }, 77, 'Traslado');

    const calls = txCalls();
    expect(calls).toHaveLength(3);
    expect(calls[0].sql).toBe('UPDATE brands SET manager_id = $1 WHERE id = $2');
    expect(calls[0].args).toEqual([20, '5']);
    expect(calls[1].sql).toContain('INSERT INTO brand_manager_history');
    expect(calls[1].args).toEqual(['5', 10, 20, 77, 'Traslado']);
    expect(calls[2].sql).toBe('SELECT id FROM projects WHERE brand_id = $1 ORDER BY id');
    expect(calls[2].args).toEqual(['5']);

    // Ninguna escritura sobre projects ni project_manager_history, ni dentro ni fuera
    const all = [...calls.map((c) => c.sql), ...mockExecute.mock.calls.map((c) => (c[0] as { sql: string }).sql)];
    expect(all.some((s) => /UPDATE\s+projects/.test(s))).toBe(false);
    expect(all.some((s) => s.includes('project_manager_history'))).toBe(false);
    const outside = mockExecute.mock.calls.map((call) => (call[0] as { sql: string }).sql);
    expect(outside.some((s) => /UPDATE|INSERT|DELETE/.test(s))).toBe(false);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockTransaction.rollback).not.toHaveBeenCalled();
    expect(result.reassignedProjectIds).toEqual([20, 21]);
    expect(result.brand?.manager_id).toBe(20);
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
    expect(revalidatePath).toHaveBeenCalledWith('/brands/5');
    expect(revalidatePath).toHaveBeenCalledWith('/clients/2');
  });

  it('S4: una marca sin proyectos devuelve [] y no revalida /projects', async () => {
    mockExecute.mockResolvedValueOnce(currentBrandRow());
    mockGetManagerById.mockResolvedValueOnce(sameClientManager());
    brandProjects([]);
    mockTransaction.commit.mockResolvedValue(undefined);
    mockExecute.mockResolvedValueOnce(currentBrandRow({ manager_id: 20 }));

    const result = await updateBrand('5', { manager_id: 20 });

    expect(result.reassignedProjectIds).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalledWith('/projects');
  });

  it('S4: hace rollback del cambio de marca si falla la lectura de sus proyectos', async () => {
    mockExecute.mockResolvedValueOnce(currentBrandRow());
    mockGetManagerById.mockResolvedValueOnce(sameClientManager());
    mockTransaction.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (/FROM projects/.test(stmt.sql)) throw new Error('projects failed');
      return makeResult([]);
    });
    mockTransaction.rollback.mockResolvedValue(undefined);

    await expect(updateBrand('5', { manager_id: 20 })).rejects.toThrow('projects failed');
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('no toca proyectos cuando el gerente no cambia', async () => {
    mockExecute.mockResolvedValueOnce(currentBrandRow());
    brandProjects([{ id: 20 }]);
    mockTransaction.commit.mockResolvedValue(undefined);
    mockExecute.mockResolvedValueOnce(currentBrandRow());

    const result = await updateBrand('5', { manager_id: 10, name: 'Otro nombre' });

    expect(txCalls().some((c) => /projects/.test(c.sql))).toBe(false);
    expect(result.reassignedProjectIds).toEqual([]);
  });

  it('un cambio solo de nombre no toca proyectos ni historial', async () => {
    brandProjects([{ id: 20 }]);
    mockTransaction.commit.mockResolvedValue(undefined);
    mockExecute.mockResolvedValueOnce(currentBrandRow());

    const result = await updateBrand('5', { name: 'Otro nombre' });

    const sql = txCalls().map((c) => c.sql);
    expect(sql).toHaveLength(1);
    expect(sql[0]).toContain('UPDATE brands SET name = $1');
    expect(result.reassignedProjectIds).toEqual([]);
  });
});

describe('getBrandsWithPagination()', () => {
  it('returns { brands: [], total: 0 } when db throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('error'));
    const result = await getBrandsWithPagination({});
    expect(result).toEqual({ brands: [], total: 0 });
  });

  it('filters by clientId using brands.client_id, not the manager client', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 0 }]))
      .mockResolvedValueOnce(makeResult([]));
    await getBrandsWithPagination({ clientId: '3' });
    const countCall = mockExecute.mock.calls[0][0] as { sql: string; args: unknown[] };
    expect(countCall.args).toEqual(expect.arrayContaining(['3']));
    expect(countCall.sql).toContain('b.client_id = $1');
    expect(countCall.sql).not.toContain('m.client_id');
  });

  it('exposes client_id on each row', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 1 }]))
      .mockResolvedValueOnce(makeResult([
        { id: 1, brand_name: 'Nike', manager_id: 10, manager_name: 'M', client_id: 3 },
      ]));
    const result = await getBrandsWithPagination({});
    expect(result.brands[0]).toEqual(expect.objectContaining({ client_id: 3 }));
  });
});
