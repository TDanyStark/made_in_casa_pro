// Mock transaction object
const mockTransaction = {
  execute: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
};

// Mock DB before any imports
jest.mock('@/lib/db', () => ({
  db: {
    execute: jest.fn(),
    transaction: jest.fn(() => Promise.resolve(mockTransaction)),
  },
}));

import { db } from '@/lib/db';
import {
  getManagerByEmail,
  getManagerById,
  getManagersByClientId,
  createManager,
  updateManager,
  getManagersWithPagination,
  getManagerClientHistory,
  getManagerTransferPreview,
  transferManager,
} from '@/lib/queries/managers';
import { revalidatePath } from 'next/cache';

const mockExecute = db.execute as jest.MockedFunction<typeof db.execute>;

function makeResult(rows: Record<string, unknown>[]) {
  return {
    rows: rows as never,
    columns: [] as string[],
    columnTypes: [] as string[],
    rowsAffected: rows.length,
    toJSON: () => ({}),
  };
}

/** Devuelve las sentencias escritas dentro de la transacción, con sus args. */
function transactionCalls(): Array<{ sql: string; args: unknown[] }> {
  return mockTransaction.execute.mock.calls.map(
    (call) => call[0] as { sql: string; args: unknown[] }
  );
}

/** Devuelve las sentencias SQL escritas dentro de la transacción. */
function transactionSql(): string[] {
  return transactionCalls().map((call) => call.sql);
}

/** Índice de la primera sentencia de la transacción que contiene `fragment`. */
function indexOfStatement(fragment: string): number {
  return transactionSql().findIndex((sql) => sql.includes(fragment));
}

beforeEach(() => {
  jest.clearAllMocks();
  // `clearAllMocks` no vacía la cola de `mockResolvedValueOnce`: sin reset, las
  // respuestas encoladas por un test se filtran al siguiente.
  mockExecute.mockReset();
  mockTransaction.execute.mockReset();
  mockTransaction.commit.mockReset();
  mockTransaction.rollback.mockReset();
  mockTransaction.execute.mockResolvedValue(makeResult([]));
  mockTransaction.commit.mockResolvedValue(undefined);
  mockTransaction.rollback.mockResolvedValue(undefined);
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

  it('returns null (does not throw) when db throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    const result = await getManagerByEmail('test@test.com');
    expect(result).toBeNull();
  });
});

describe('getManagerById()', () => {
  it('returns null when db returns no rows', async () => {
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
  it('calls execute with WHERE client_id = $1 and the correct arg', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await getManagersByClientId('5');
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('WHERE client_id = $1'),
      args: ['5'],
    }));
  });

  it('returns an empty array when db throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('error'));
    const result = await getManagersByClientId('1');
    expect(result).toEqual([]);
  });
});

describe('createManager()', () => {
  it('calls db.execute with INSERT SQL and 5 args', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 7 }]));
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
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 8 }]));
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
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 9 }]));
    await createManager({
      client_id: 3,
      name: 'Manager',
      email: 'm@test.com',
      phone: '555',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/clients/3');
  });

  it('returns id from RETURNING clause as number', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 42 }]));
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
      sql: expect.stringContaining('email = $1'),
    }));
    expect(updateCall[0]).toEqual(expect.objectContaining({
      sql: expect.not.stringContaining('phone = $'),
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

  it('returns { managers: [], total: 0 } when db throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('error'));
    const result = await getManagersWithPagination({});
    expect(result).toEqual({ managers: [], total: 0 });
  });
});

describe('transferManager()', () => {
  /** Gerente 2, hoy en el cliente 5. */
  const CURRENT_MANAGER = { id: 2, client_id: 5, email: 'mon@old.com' };

  /**
   * Encola las lecturas previas al traslado en el orden que hace la query:
   * gerente -> cliente destino -> (email) -> (marca -> sucesor) -> (proyecto -> sucesor)
   */
  function queueBaseReads({ emailCheck = false } = {}) {
    mockExecute.mockResolvedValueOnce(makeResult([CURRENT_MANAGER])); // manager
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 9 }]));       // target client
    if (emailCheck) {
      mockExecute.mockResolvedValueOnce(makeResult([]));              // email libre
    }
  }

  it('mueve la fila del gerente en vez de crear una nueva y registra la trayectoria', async () => {
    queueBaseReads();
    mockExecute.mockResolvedValueOnce(makeResult([])); // getManagerById final

    const result = await transferManager({
      managerId: 2,
      targetClientId: 9,
      reason: 'Cambio de laboratorio',
      changedBy: 77,
    });

    const sql = transactionSql();
    expect(sql.some((s) => s.includes('UPDATE managers SET client_id = $1'))).toBe(true);
    expect(sql.some((s) => s.includes('INSERT INTO manager_client_history'))).toBe(true);
    // Nada de INSERT INTO managers: el gerente es siempre la misma fila
    expect(sql.some((s) => s.includes('INSERT INTO managers'))).toBe(false);
    expect(mockTransaction.commit).toHaveBeenCalled();
    expect(result.previous_client_id).toBe(5);
    expect(result.new_client_id).toBe(9);
  });

  it('revalida las rutas del cliente viejo y del nuevo', async () => {
    queueBaseReads();
    mockExecute.mockResolvedValueOnce(makeResult([]));

    await transferManager({ managerId: 2, targetClientId: 9 });

    expect(revalidatePath).toHaveBeenCalledWith('/clients/5');
    expect(revalidatePath).toHaveBeenCalledWith('/clients/9');
    expect(revalidatePath).toHaveBeenCalledWith('/managers/2');
  });

  it('rechaza el traslado si el cliente destino es el actual', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([CURRENT_MANAGER]));

    await expect(transferManager({ managerId: 2, targetClientId: 5 }))
      .rejects.toMatchObject({ code: 'SAME_CLIENT' });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('rechaza el traslado de un gerente inexistente', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));

    await expect(transferManager({ managerId: 404, targetClientId: 9 }))
      .rejects.toMatchObject({ code: 'MANAGER_NOT_FOUND' });
  });

  it('rechaza un email que ya usa otro gerente (managers.email es UNIQUE global)', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([CURRENT_MANAGER]));
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 9 }]));
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 33 }])); // email ocupado

    await expect(transferManager({
      managerId: 2, targetClientId: 9, email: 'mon@new.com',
    })).rejects.toMatchObject({ code: 'EMAIL_IN_USE' });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('reasigna marcas al sucesor y escribe brand_manager_history', async () => {
    queueBaseReads();
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 4, client_id: 5, manager_id: 2 }])); // marca
    mockExecute.mockResolvedValueOnce(makeResult([{ client_id: 5 }]));                       // sucesor
    mockExecute.mockResolvedValueOnce(makeResult([])); // getManagerById final

    const result = await transferManager({
      managerId: 2,
      targetClientId: 9,
      brandReassignments: [{ brand_id: 4, new_manager_id: 11 }],
    });

    const sql = transactionSql();
    expect(sql.some((s) => s.includes('UPDATE brands SET manager_id'))).toBe(true);
    expect(sql.some((s) => s.includes('INSERT INTO brand_manager_history'))).toBe(true);
    expect(result.reassigned_brands).toBe(1);
  });

  it('reasigna proyectos al sucesor y escribe project_manager_history', async () => {
    queueBaseReads();
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 11, client_id: 5, manager_id: 2 }])); // proyecto
    mockExecute.mockResolvedValueOnce(makeResult([{ client_id: 5 }]));                        // sucesor
    mockExecute.mockResolvedValueOnce(makeResult([]));

    const result = await transferManager({
      managerId: 2,
      targetClientId: 9,
      projectReassignments: [{ project_id: 11, new_manager_id: 11 }],
    });

    const sql = transactionSql();
    expect(sql.some((s) => s.includes('UPDATE projects SET manager_id'))).toBe(true);
    expect(sql.some((s) => s.includes('INSERT INTO project_manager_history'))).toBe(true);
    expect(result.reassigned_projects).toBe(1);
  });

  it('rechaza un sucesor que no pertenece al cliente que se está dejando', async () => {
    queueBaseReads();
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 4, client_id: 5, manager_id: 2 }]));
    mockExecute.mockResolvedValueOnce(makeResult([{ client_id: 99 }])); // sucesor de otro cliente

    await expect(transferManager({
      managerId: 2,
      targetClientId: 9,
      brandReassignments: [{ brand_id: 4, new_manager_id: 50 }],
    })).rejects.toMatchObject({ code: 'MANAGER_CLIENT_MISMATCH' });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('rechaza reasignar una marca que ya no es del cliente viejo', async () => {
    queueBaseReads();
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 4, client_id: 77, manager_id: 2 }]));

    await expect(transferManager({
      managerId: 2,
      targetClientId: 9,
      brandReassignments: [{ brand_id: 4, new_manager_id: 11 }],
    })).rejects.toMatchObject({ code: 'MANAGER_CLIENT_MISMATCH' });
  });

  it('rechaza un sucesor que es el propio gerente trasladado', async () => {
    queueBaseReads();
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 4, client_id: 5, manager_id: 2 }]));

    await expect(transferManager({
      managerId: 2,
      targetClientId: 9,
      brandReassignments: [{ brand_id: 4, new_manager_id: 2 }],
    })).rejects.toMatchObject({ code: 'MANAGER_CLIENT_MISMATCH' });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('rechaza un sucesor de proyecto que pertenece a otro cliente', async () => {
    queueBaseReads();
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 11, client_id: 5, manager_id: 2 }]));
    mockExecute.mockResolvedValueOnce(makeResult([{ client_id: 99 }])); // sucesor de otro cliente

    await expect(transferManager({
      managerId: 2,
      targetClientId: 9,
      projectReassignments: [{ project_id: 11, new_manager_id: 50 }],
    })).rejects.toMatchObject({ code: 'MANAGER_CLIENT_MISMATCH' });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  // ── Regresión: las marcas/proyectos SIN sucesor viajan con el gerente ──────
  // Sin estos UPDATE la marca se quedaba con el `client_id` del laboratorio
  // viejo mientras su gerente ya estaba en el nuevo: dos fuentes de verdad
  // en desacuerdo.

  it('mueve al cliente destino las marcas que se quedan con el gerente', async () => {
    queueBaseReads();
    mockExecute.mockResolvedValueOnce(makeResult([])); // getManagerById final

    await transferManager({ managerId: 2, targetClientId: 9 });

    const moveBrands = transactionCalls().find((call) =>
      call.sql.includes('UPDATE brands SET client_id = $1')
    );
    expect(moveBrands).toBeDefined();
    // Solo las marcas que SIGUEN apuntando al gerente trasladado, y solo si su
    // cliente difiere del destino (idempotente).
    expect(moveBrands!.sql).toContain('WHERE manager_id = $2 AND client_id <> $1');
    expect(moveBrands!.args).toEqual([9, 2]);
  });

  it('mueve los proyectos al cliente DE SU MARCA, no al del gerente', async () => {
    queueBaseReads();
    mockExecute.mockResolvedValueOnce(makeResult([]));

    await transferManager({ managerId: 2, targetClientId: 9 });

    const moveProjects = transactionCalls().find(
      (call) =>
        call.sql.includes('UPDATE projects') &&
        call.sql.includes('SET client_id = b.client_id')
    );
    expect(moveProjects).toBeDefined();
    expect(moveProjects!.sql).toContain('FROM brands b');
    expect(moveProjects!.sql).toContain('b.id = projects.brand_id');
    expect(moveProjects!.sql).toContain('projects.manager_id = $1');
    expect(moveProjects!.sql).toContain('projects.client_id <> b.client_id');
    // El cliente destino NO aparece: el proyecto hereda el de su marca.
    expect(moveProjects!.args).toEqual([2]);
  });

  it('devuelve moved_brands / moved_projects además de reassigned_*', async () => {
    queueBaseReads();
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 4, client_id: 5, manager_id: 2 }])); // marca
    mockExecute.mockResolvedValueOnce(makeResult([{ client_id: 5 }]));                       // sucesor
    mockExecute.mockResolvedValueOnce(makeResult([])); // getManagerById final

    // 1º UPDATE brands SET manager_id, 2º INSERT brand_manager_history,
    // 3º UPDATE brands SET client_id (2 filas), 4º UPDATE projects (3 filas).
    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([{ id: 6 }, { id: 7 }]))
      .mockResolvedValueOnce(makeResult([{ id: 20 }, { id: 21 }, { id: 22 }]));

    const result = await transferManager({
      managerId: 2,
      targetClientId: 9,
      brandReassignments: [{ brand_id: 4, new_manager_id: 11 }],
    });

    expect(result).toEqual(expect.objectContaining({
      previous_client_id: 5,
      new_client_id: 9,
      reassigned_brands: 1,
      reassigned_projects: 0,
      moved_brands: 2,
      moved_projects: 3,
    }));
  });

  it('a la marca con sucesor le cambia el gerente pero NO el cliente', async () => {
    queueBaseReads();
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 4, client_id: 5, manager_id: 2 }]));
    mockExecute.mockResolvedValueOnce(makeResult([{ client_id: 5 }]));
    mockExecute.mockResolvedValueOnce(makeResult([]));

    await transferManager({
      managerId: 2,
      targetClientId: 9,
      changedBy: 77,
      reason: 'Traslado',
      brandReassignments: [{ brand_id: 4, new_manager_id: 11 }],
    });

    const calls = transactionCalls();

    const reassign = calls.find((call) => call.sql.includes('UPDATE brands SET manager_id'));
    expect(reassign).toBeDefined();
    expect(reassign!.sql).not.toContain('client_id');
    expect(reassign!.args).toEqual([11, 4]);

    const history = calls.find((call) => call.sql.includes('INSERT INTO brand_manager_history'));
    expect(history!.args).toEqual([4, 2, 11, 77, 'Traslado']);

    // La marca 4 queda fuera del movimiento masivo porque ya no apunta al
    // gerente trasladado: el UPDATE está acotado por `manager_id`.
    const move = calls.find((call) => call.sql.includes('UPDATE brands SET client_id = $1'));
    expect(move!.sql).toContain('WHERE manager_id = $2');
    expect(move!.args).toEqual([9, 2]);
  });

  it('reasigna a los sucesores ANTES de mover nada de cliente', async () => {
    queueBaseReads();
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 4, client_id: 5, manager_id: 2 }]));  // marca
    mockExecute.mockResolvedValueOnce(makeResult([{ client_id: 5 }]));                        // sucesor
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 11, client_id: 5, manager_id: 2 }])); // proyecto
    mockExecute.mockResolvedValueOnce(makeResult([{ client_id: 5 }]));                        // sucesor
    mockExecute.mockResolvedValueOnce(makeResult([]));

    await transferManager({
      managerId: 2,
      targetClientId: 9,
      brandReassignments: [{ brand_id: 4, new_manager_id: 11 }],
      projectReassignments: [{ project_id: 11, new_manager_id: 11 }],
    });

    const reassignBrand = indexOfStatement('UPDATE brands SET manager_id');
    const reassignProject = indexOfStatement('UPDATE projects SET manager_id');
    const moveBrands = indexOfStatement('UPDATE brands SET client_id = $1');
    const moveProjects = indexOfStatement('SET client_id = b.client_id');
    const moveManager = indexOfStatement('UPDATE managers SET client_id = $1');

    // Si el gerente se moviera primero, los sucesores validados contra el
    // cliente viejo quedarían apuntando a un laboratorio que ya no es el suyo.
    expect(reassignBrand).toBeGreaterThanOrEqual(0);
    expect(reassignProject).toBeGreaterThanOrEqual(0);
    expect(moveBrands).toBeGreaterThan(reassignBrand);
    expect(moveBrands).toBeGreaterThan(reassignProject);
    // Los proyectos se recalculan DESPUÉS de que las marcas tengan su cliente
    // definitivo, porque heredan de ellas.
    expect(moveProjects).toBeGreaterThan(moveBrands);
    expect(moveManager).toBeGreaterThan(moveProjects);
  });

  it('escribe reasignaciones, movimientos e historial en UNA sola transacción', async () => {
    queueBaseReads();
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 4, client_id: 5, manager_id: 2 }]));
    mockExecute.mockResolvedValueOnce(makeResult([{ client_id: 5 }]));
    mockExecute.mockResolvedValueOnce(makeResult([]));

    await transferManager({
      managerId: 2,
      targetClientId: 9,
      brandReassignments: [{ brand_id: 4, new_manager_id: 11 }],
    });

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(db.transaction).toHaveBeenCalledWith('write');
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockTransaction.rollback).not.toHaveBeenCalled();

    const sql = transactionSql();
    expect(sql).toHaveLength(6); // 2 reasignación + 2 movimiento + 2 gerente
    expect(sql.some((s) => s.includes('UPDATE brands SET client_id = $1'))).toBe(true);
    expect(sql.some((s) => s.includes('SET client_id = b.client_id'))).toBe(true);
    expect(sql.some((s) => s.includes('INSERT INTO manager_client_history'))).toBe(true);

    // Ninguna escritura se escapa de la transacción vía db.execute.
    const outside = mockExecute.mock.calls.map((call) => (call[0] as { sql: string }).sql);
    expect(outside.some((s) => /UPDATE|INSERT|DELETE/.test(s))).toBe(false);
  });

  it('hace rollback si falla cualquier escritura', async () => {
    queueBaseReads();
    mockTransaction.execute.mockRejectedValueOnce(new Error('TX error'));

    await expect(transferManager({ managerId: 2, targetClientId: 9 }))
      .rejects.toThrow('TX error');
    expect(mockTransaction.rollback).toHaveBeenCalled();
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  it('hace rollback si falla el movimiento de cliente de las marcas', async () => {
    queueBaseReads();
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 4, client_id: 5, manager_id: 2 }]));
    mockExecute.mockResolvedValueOnce(makeResult([{ client_id: 5 }]));
    // Las dos primeras (reasignación de marca) pasan; el UPDATE de cliente falla.
    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([]))
      .mockRejectedValueOnce(new Error('move failed'));

    await expect(transferManager({
      managerId: 2,
      targetClientId: 9,
      brandReassignments: [{ brand_id: 4, new_manager_id: 11 }],
    })).rejects.toThrow('move failed');

    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
    // El gerente no llegó a moverse.
    expect(transactionSql().some((s) => s.includes('UPDATE managers'))).toBe(false);
  });
});

describe('getManagerTransferPreview()', () => {
  it('returns null when the manager does not exist', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    const result = await getManagerTransferPreview(2);
    expect(result).toBeNull();
  });

  it('lista marcas, proyectos no archivados y sucesores del cliente actual', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 2, client_id: 5, name: 'Monica', email: 'm@m.com', phone: '0',
      biography: '', client_name: 'Adium', accept_business_units: 0,
      country_id: null, country_name: null, country_flag: null,
    }]));
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 4, name: 'Nulytely' }]));
    mockExecute.mockResolvedValueOnce(makeResult([
      { id: 11, title: 'Nulytelly 2026', status: 'active', brand_id: 4, brand_name: 'Nulytely' },
    ]));
    mockExecute.mockResolvedValueOnce(makeResult([
      { id: 11, name: 'Luis Sandoval', email: 'luis@adium.com' },
    ]));

    const result = await getManagerTransferPreview(2);

    expect(result?.brands).toHaveLength(1);
    expect(result?.projects).toHaveLength(1);
    expect(result?.available_managers[0].name).toBe('Luis Sandoval');
    expect(result?.current_client?.name).toBe('Adium');

    const projectsSql = (mockExecute.mock.calls[2][0] as { sql: string }).sql;
    expect(projectsSql).toContain("p.status <> 'archived'");
    // El sucesor nunca puede ser el propio gerente
    expect((mockExecute.mock.calls[3][0] as { sql: string }).sql).toContain('id <> $2');
  });
});

describe('getManagerClientHistory()', () => {
  it('resuelve nombres de cliente previo, nuevo y del actor', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 1, manager_id: 2,
      previous_client_id: 2, previous_client_name: 'Adium Co',
      new_client_id: 1, new_client_name: 'Abbott Co',
      changed_by: 77, changed_by_name: 'Admin',
      reason: 'Traslado', changed_at: '2026-01-01T00:00:00.000Z',
    }]));

    const result = await getManagerClientHistory(2);

    expect(result[0]).toEqual(expect.objectContaining({
      previousClientName: 'Adium Co',
      newClientName: 'Abbott Co',
      changedByName: 'Admin',
    }));
  });

  it('returns an empty array when db throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('error'));
    expect(await getManagerClientHistory(2)).toEqual([]);
  });
});
