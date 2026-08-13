const mockTransaction = {
  execute: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
};

jest.mock('@/lib/db', () => ({
  db: {
    execute: jest.fn(),
    transaction: jest.fn(() => Promise.resolve(mockTransaction)),
  },
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

import { db } from '@/lib/db';
import {
  createProject,
  getProjectById,
  getProjectManagerHistory,
  getProjectsWithPagination,
  recalculateProjectProgress,
  updateProject,
} from '@/lib/queries/projects';

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

// `clearAllMocks` no vacía la cola de `mockResolvedValueOnce`: hay que resetear
// para que un test no herede respuestas encoladas por el anterior.
beforeEach(() => {
  jest.clearAllMocks();
  mockExecute.mockReset();
  mockTransaction.execute.mockReset();
  mockTransaction.commit.mockReset();
  mockTransaction.rollback.mockReset();
  mockTransaction.execute.mockResolvedValue(makeResult([]));
  mockTransaction.commit.mockResolvedValue(undefined);
  mockTransaction.rollback.mockResolvedValue(undefined);
});

describe('project queries metadata fields', () => {

  it('getProjectById selects the new metadata columns', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 1, ideal_delivery_at: null, oc: null, billing_closed_at: null }]));

    await getProjectById(1);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining('p.ideal_delivery_at'),
      })
    );
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining('p.billing_closed_at'),
      })
    );
  });

  it('getProjectById resolves the client from projects.client_id, not from the manager', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 1 }]));

    await getProjectById(1);

    const sql = (mockExecute.mock.calls[0]?.[0] as { sql: string }).sql;
    expect(sql).toContain('LEFT JOIN clients          cl  ON p.client_id   = cl.id');
    expect(sql).not.toContain('cl  ON m.client_id');
  });

  it('createProject persists ideal delivery, oc, billing closure and the brand client', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ client_id: 7 }])) // cliente de la marca
      .mockResolvedValueOnce(makeResult([{ client_id: 7 }])) // cliente del gerente
      .mockResolvedValueOnce(makeResult([{ id: 15 }]))       // INSERT
      .mockResolvedValueOnce(makeResult([]))                 // project_adjustments
      .mockResolvedValueOnce(
        makeResult([
          {
            id: 15,
            title: 'Proyecto',
            ideal_delivery_at: '2026-04-07T14:30:00.000Z',
            oc: 'OC-100',
            billing_closed_at: '2026-04-20T17:00:00.000Z',
          },
        ])
      );

    await createProject({
      title: 'Proyecto',
      brand_id: 2,
      manager_id: 3,
      ideal_delivery_at: '2026-04-07T14:30:00.000Z',
      oc: 'OC-100',
      billing_closed_at: '2026-04-20T17:00:00.000Z',
    });

    expect(mockExecute).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        sql: expect.stringContaining('billing_closed_at'),
        args: [
          'Proyecto',
          2,
          3,
          7, // client_id heredado de la marca, no del gerente
          null,
          null,
          null,
          null,
          null,
          '2026-04-07T14:30:00.000Z',
          'OC-100',
          '2026-04-20T17:00:00.000Z',
          'active',
          null,
        ],
      })
    );
  });

  it('createProject rejects a manager from a client other than the brand client', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ client_id: 7 }]))  // marca -> cliente 7
      .mockResolvedValueOnce(makeResult([{ client_id: 99 }])); // gerente -> cliente 99

    await expect(
      createProject({ title: 'Proyecto', brand_id: 2, manager_id: 3 })
    ).rejects.toMatchObject({ code: 'MANAGER_CLIENT_MISMATCH' });

    // No debe haber llegado al INSERT
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it('createProject rejects a non-existent brand', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));

    await expect(
      createProject({ title: 'Proyecto', brand_id: 404, manager_id: 3 })
    ).rejects.toMatchObject({ code: 'BRAND_NOT_FOUND' });
  });

  it('updateProject patches the new metadata fields without touching completed_at', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ id: 9, status: 'active' }]))
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(
        makeResult([
          {
            id: 9,
            ideal_delivery_at: '2026-04-07T14:30:00.000Z',
            oc: null,
            billing_closed_at: '2026-04-20T17:00:00.000Z',
          },
        ])
      );

    await updateProject(9, {
      ideal_delivery_at: '2026-04-07T14:30:00.000Z',
      oc: null,
      billing_closed_at: '2026-04-20T17:00:00.000Z',
    });

    expect(mockExecute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sql: expect.stringContaining('ideal_delivery_at = $1'),
        args: [
          '2026-04-07T14:30:00.000Z',
          null,
          '2026-04-20T17:00:00.000Z',
          9,
        ],
      })
    );
    expect((mockExecute.mock.calls[1]?.[0] as { sql: string }).sql).not.toContain('completed_at');
  });

  // Desde que el cierre pasó a su flujo dedicado (`completeProject`), llegar al
  // 100% ya NO completa el proyecto solo: recalcular únicamente mueve `progress`.
  it('recalculateProjectProgress updates progress without completing the project', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ id: 33 }]))
      .mockResolvedValueOnce(makeResult([{ total: '4', completed: '4' }]))
      .mockResolvedValueOnce(makeResult([]));

    const progress = await recalculateProjectProgress(33);

    expect(progress).toBe(100);
    expect(mockExecute).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        sql: expect.stringContaining('UPDATE projects SET progress = $1'),
        args: [100, 33],
      })
    );

    const finalUpdateSql = (mockExecute.mock.calls[2]?.[0] as { sql: string }).sql;
    expect(finalUpdateSql).not.toContain('completed_at');
    expect(finalUpdateSql).not.toContain('billing_closed_at');
  });
});

describe('reasignación de gerente del proyecto', () => {
  /** Proyecto 9: gerente 3, cliente 7. */
  const CURRENT_PROJECT = { id: 9, status: 'active', manager_id: 3, client_id: 7 };

  it('actualiza manager_id y audita el cambio en la misma transacción', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([CURRENT_PROJECT]))   // getProjectById
      .mockResolvedValueOnce(makeResult([{ client_id: 7 }]))  // gerente nuevo, mismo cliente
      .mockResolvedValueOnce(makeResult([CURRENT_PROJECT]));  // getProjectById final

    await updateProject(9, { manager_id: 12 }, 77, 'Traslado de Monica');

    const sqls = mockTransaction.execute.mock.calls.map(
      (call) => call[0] as { sql: string; args: unknown[] }
    );
    expect(sqls[0].sql).toContain('manager_id = $1');
    expect(sqls[1].sql).toContain('INSERT INTO project_manager_history');
    expect(sqls[1].args).toEqual([9, 3, 12, 77, 'Traslado de Monica']);
    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  // ── Invariante: reasignar el gerente NUNCA mueve el proyecto de cliente ────

  it('rechaza un gerente de otro cliente sin tocar el proyecto', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([CURRENT_PROJECT]))
      .mockResolvedValueOnce(makeResult([{ client_id: 99 }]));

    await expect(updateProject(9, { manager_id: 12 }))
      .rejects.toMatchObject({ code: 'MANAGER_CLIENT_MISMATCH' });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('no ejecuta ningún UPDATE cuando el gerente es de otro cliente', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([CURRENT_PROJECT]))   // getProjectById
      .mockResolvedValueOnce(makeResult([{ client_id: 99 }])); // gerente -> cliente 99

    await expect(
      updateProject(9, { manager_id: 12, title: 'Nuevo título' })
    ).rejects.toMatchObject({ code: 'MANAGER_CLIENT_MISMATCH' });

    // Solo las dos lecturas: la validación corta antes de construir el UPDATE,
    // así que ni siquiera el `title` del mismo patch llega a escribirse.
    expect(mockExecute).toHaveBeenCalledTimes(2);
    const sqls = mockExecute.mock.calls.map((call) => (call[0] as { sql: string }).sql);
    expect(sqls.some((sql) => sql.includes('UPDATE projects'))).toBe(false);
    expect(mockTransaction.execute).not.toHaveBeenCalled();
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  it('rechaza un gerente inexistente antes de escribir', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([CURRENT_PROJECT]))
      .mockResolvedValueOnce(makeResult([])); // el gerente no existe

    await expect(updateProject(9, { manager_id: 404 }))
      .rejects.toMatchObject({ code: 'MANAGER_NOT_FOUND' });
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('un cambio válido escribe en project_manager_history y no toca client_id', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([CURRENT_PROJECT]))   // getProjectById
      .mockResolvedValueOnce(makeResult([{ client_id: 7 }]))  // gerente nuevo, mismo cliente
      .mockResolvedValueOnce(makeResult([CURRENT_PROJECT]));  // getProjectById final

    await updateProject(9, { manager_id: 12 }, 77, 'Reasignación');

    const calls = mockTransaction.execute.mock.calls.map(
      (call) => call[0] as { sql: string; args: unknown[] }
    );

    const update = calls.find((call) => call.sql.includes('UPDATE projects'));
    expect(update).toBeDefined();
    expect(update!.sql).toContain('manager_id = $1');
    // El cliente del proyecto es suyo: cambiar de responsable no lo reescribe.
    expect(update!.sql).not.toContain('client_id');

    const history = calls.find((call) =>
      call.sql.includes('INSERT INTO project_manager_history')
    );
    expect(history).toBeDefined();
    expect(history!.args).toEqual([9, 3, 12, 77, 'Reasignación']);

    // La validación se hizo contra projects.client_id, no contra el gerente.
    const managerCheck = mockExecute.mock.calls[1]?.[0] as { sql: string; args: unknown[] };
    expect(managerCheck.sql).toContain('SELECT client_id FROM managers WHERE id = $1');
    expect(managerCheck.args).toEqual([12]);
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
  });

  it('registra previous_manager_id null cuando el proyecto no tenía gerente', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ ...CURRENT_PROJECT, manager_id: null }]))
      .mockResolvedValueOnce(makeResult([{ client_id: 7 }]))
      .mockResolvedValueOnce(makeResult([CURRENT_PROJECT]));

    await updateProject(9, { manager_id: 12 });

    const history = mockTransaction.execute.mock.calls
      .map((call) => call[0] as { sql: string; args: unknown[] })
      .find((call) => call.sql.includes('INSERT INTO project_manager_history'));
    expect(history!.args).toEqual([9, null, 12, null, null]);
  });

  it('no abre transacción ni audita cuando el gerente es el mismo', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([CURRENT_PROJECT]))
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([CURRENT_PROJECT]));

    await updateProject(9, { manager_id: 3, title: 'Nuevo título' });

    expect(db.transaction).not.toHaveBeenCalled();
    const updateSql = (mockExecute.mock.calls[1]?.[0] as { sql: string }).sql;
    expect(updateSql).not.toContain('manager_id');
  });

  it('hace rollback si falla la auditoría', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([CURRENT_PROJECT]))
      .mockResolvedValueOnce(makeResult([{ client_id: 7 }]));
    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([]))
      .mockRejectedValueOnce(new Error('TX error'));

    await expect(updateProject(9, { manager_id: 12 })).rejects.toThrow('TX error');
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });
});

describe('getProjectsWithPagination()', () => {
  it('filtra por client_id usando la columna propia del proyecto', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 0 }]))
      .mockResolvedValueOnce(makeResult([]));

    await getProjectsWithPagination({ clientId: 7 });

    const countCall = mockExecute.mock.calls[0]?.[0] as { sql: string; args: unknown[] };
    expect(countCall.sql).toContain('p.client_id = $1');
    expect(countCall.args).toEqual([7]);
  });
});

describe('getProjectManagerHistory()', () => {
  it('resuelve nombres del gerente previo, el nuevo y el actor', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 1, project_id: 11,
      previous_manager_id: 2, previous_manager_name: 'Monica Robles',
      new_manager_id: 11, new_manager_name: 'Luis Sandoval',
      changed_by: 77, changed_by_name: 'Admin',
      reason: 'Reasignación', changed_at: '2026-01-01T00:00:00.000Z',
    }]));

    const result = await getProjectManagerHistory(11);

    expect(result[0]).toEqual(expect.objectContaining({
      previousManagerName: 'Monica Robles',
      newManagerName: 'Luis Sandoval',
      changedByName: 'Admin',
    }));
  });

  it('returns an empty array when db throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('error'));
    expect(await getProjectManagerHistory(11)).toEqual([]);
  });
});
