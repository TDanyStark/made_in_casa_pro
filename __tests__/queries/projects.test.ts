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
  cascadeBrandManagerToProjects,
  createProject,
  clearProjectDriveAccessFailure,
  getProjectDriveAccessFailures,
  getProjectExpectedDriveRecipients,
  getProjectById,
  getProjectManagerHistory,
  getProjectStakeholderEmails,
  getProjectsWithPagination,
  recalculateProjectProgress,
  recalculateProjectProgressWithTransition,
  updateProject,
  upsertProjectDriveAccessFailure,
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

  it('normalizes and deduplicates Drive stakeholders while preserving all sources', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([
      { email: ' Admin@Test.com ', name: 'Admin', source: 'leadership' },
      { email: 'admin@test.com', name: 'Admin', source: 'creator' },
      { email: 'manager@test.com', name: 'Manager', source: 'manager' },
      { email: 'manager@test.com', name: 'Manager', source: 'co_manager' },
      { email: 'invalid', name: 'Invalid', source: 'task_assignee' },
    ]));

    await expect(getProjectExpectedDriveRecipients(15)).resolves.toEqual([
      { email: 'admin@test.com', name: 'Admin', sources: ['leadership', 'creator'] },
      { email: 'manager@test.com', name: 'Manager', sources: ['manager', 'co_manager'] },
    ]);
    const call = mockExecute.mock.calls[0]?.[0] as { sql: string; args: unknown[] };
    expect(call.args[0]).toBe(15);
    expect(call.args).toEqual([15, 1, 2, 5]);
    expect(call.sql).toContain("'task_assignee' AS source");
    expect(call.sql).toContain("'co_manager' AS source");
    expect(call.sql).not.toContain('m.client_id');
  });

  it('keeps the email-only stakeholder API normalized', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([
      { email: ' Person@Test.com ', name: 'Person', source: 'task_assignee' },
    ]));
    await expect(getProjectStakeholderEmails(15)).resolves.toEqual(['person@test.com']);
  });

  it('reads, upserts, and clears sanitized Drive failures by normalized email', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([
      { email: 'person@test.com', failure_code: 'NO_GOOGLE_ACCOUNT', last_attempt_at: '2026-08-19T12:00:00Z' },
    ]));
    await expect(getProjectDriveAccessFailures(15)).resolves.toEqual([{
      email: 'person@test.com',
      failureCode: 'NO_GOOGLE_ACCOUNT',
      lastAttemptAt: '2026-08-19T12:00:00Z',
    }]);

    await upsertProjectDriveAccessFailure(15, ' Person@Test.com ', 'POLICY_OR_RESTRICTION');
    expect(mockExecute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      sql: expect.stringContaining('ON CONFLICT (project_id, email) DO UPDATE'),
      args: [15, 'person@test.com', 'POLICY_OR_RESTRICTION'],
    }));

    await clearProjectDriveAccessFailure(15, ' Person@Test.com ');
    expect(mockExecute).toHaveBeenNthCalledWith(3, expect.objectContaining({
      sql: expect.stringContaining('DELETE FROM project_drive_access_failures'),
      args: [15, 'person@test.com'],
    }));
  });

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
    // INSERT del proyecto y de su V1 en la misma transacción
    mockTransaction.execute.mockResolvedValueOnce(makeResult([{ id: 15 }]));
    mockExecute
      .mockResolvedValueOnce(makeResult([{ client_id: 7, manager_id: 3 }])) // marca: cliente y gerente
      .mockResolvedValueOnce(makeResult([{ client_id: 7 }])) // cliente del gerente
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

    expect(mockTransaction.execute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sql: expect.stringContaining('billing_closed_at'),
        args: [
          'Proyecto',
          2,
          3,
          3, // created_manager_id: gerente al crearse = manager_id (S7)
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
      .mockResolvedValueOnce(makeResult([{ client_id: 7, manager_id: 3 }]))  // marca -> cliente 7
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

});

describe('automatic completion of the latest version', () => {
  function queue(total: number, completed: number, status = 'active') {
    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([{ status, progress: status === 'completed' ? 100 : 50 }]))
      .mockResolvedValueOnce(makeResult([{ id: 70 }]))
      .mockResolvedValueOnce(makeResult([{ total: String(total), completed: String(completed) }]));
  }

  it('completes project and latest version together when all tasks finish', async () => {
    queue(4, 4);
    await expect(recalculateProjectProgressWithTransition(33)).resolves.toEqual({ progress: 100, reachedCompletion: true });
    expect(mockTransaction.execute).toHaveBeenCalledWith(expect.objectContaining({ sql: expect.stringContaining('FOR UPDATE') }));
    expect(mockTransaction.execute).toHaveBeenCalledWith(expect.objectContaining({ sql: expect.stringContaining('UPDATE projects'), args: [100, 'completed', 33] }));
    expect(mockTransaction.execute).toHaveBeenCalledWith(expect.objectContaining({ sql: expect.stringContaining('UPDATE project_adjustments'), args: ['completed', 70] }));
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
  });

  it('reopens the completed project and same version after a pending task is added', async () => {
    queue(5, 4, 'completed');
    await expect(recalculateProjectProgressWithTransition(33)).resolves.toEqual({ progress: 80, reachedCompletion: false });
    expect(mockTransaction.execute).toHaveBeenCalledWith(expect.objectContaining({ args: [80, 'active', 33] }));
    expect(mockTransaction.execute).toHaveBeenCalledWith(expect.objectContaining({ args: ['active', 70] }));
    expect(mockTransaction.execute.mock.calls.some(([q]) => /UPDATE project_tasks/.test(q.sql))).toBe(false);
  });

  it('keeps a completed version at 100 without sending another notice', async () => {
    queue(4, 4, 'completed');
    await expect(recalculateProjectProgressWithTransition(33)).resolves.toEqual({ progress: 100, reachedCompletion: false });
    const versionQuery = mockTransaction.execute.mock.calls[1][0].sql;
    expect(versionQuery).not.toContain("status = 'active'");
    expect(versionQuery).toContain('version_number DESC');
  });

  it('never rounds unfinished tasks up to 100', async () => {
    queue(200, 199);
    await expect(recalculateProjectProgressWithTransition(33)).resolves.toEqual({ progress: 99, reachedCompletion: false });
  });

  it('does not complete an empty version', async () => {
    queue(0, 0);
    await expect(recalculateProjectProgressWithTransition(33)).resolves.toEqual({ progress: 0, reachedCompletion: false });
  });

  it('notifies again after reopening and completing the version', async () => {
    queue(5, 4, 'completed');
    await recalculateProjectProgressWithTransition(33);
    queue(5, 5);
    await expect(recalculateProjectProgressWithTransition(33)).resolves.toEqual({ progress: 100, reachedCompletion: true });
  });

  it('preserves paused and archived states while recalculating pending tasks', async () => {
    for (const status of ['paused', 'archived']) {
      queue(4, 3, status);
      await recalculateProjectProgressWithTransition(33);
      expect(mockTransaction.execute).toHaveBeenCalledWith(expect.objectContaining({ args: [75, status, 33] }));
    }
  });

  it('rolls back if updating the version fails', async () => {
    queue(4, 4);
    mockTransaction.execute.mockResolvedValueOnce(makeResult([])).mockRejectedValueOnce(new Error('version update failed'));
    await expect(recalculateProjectProgressWithTransition(33)).rejects.toThrow('version update failed');
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  it('preserves the numeric return contract', async () => {
    queue(4, 4);
    await expect(recalculateProjectProgress(33)).resolves.toBe(100);
  });
});

describe('gerente del proyecto: lo define su marca principal', () => {
  // Spec: odd/tasks/brand-owned-project-manager.md — S3, S5
  const CURRENT_PROJECT = { id: 9, status: 'active', manager_id: 3, client_id: 7 };

  it('S3: updateProject ya no reasigna el gerente aunque llegue manager_id', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([CURRENT_PROJECT]))  // getProjectById
      .mockResolvedValueOnce(makeResult([]))                 // UPDATE
      .mockResolvedValueOnce(makeResult([CURRENT_PROJECT])); // getProjectById final

    await updateProject(9, { title: 'Nuevo título', manager_id: 12 } as never);

    expect(db.transaction).not.toHaveBeenCalled();
    const sqls = mockExecute.mock.calls.map((call) => call[0] as { sql: string; args: unknown[] });
    expect(sqls).toHaveLength(3);
    expect(sqls[1].sql).toBe('UPDATE projects SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2');
    expect(sqls[1].args).toEqual(['Nuevo título', 9]);
    expect(sqls.some((call) => call.sql.includes('SELECT client_id FROM managers'))).toBe(false);
    expect(sqls.some((call) => call.sql.includes('project_manager_history'))).toBe(false);
  });

  it('S5: createProject rechaza un gerente distinto al de la marca principal sin escribir', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ client_id: 7, manager_id: 4 }])); // marca

    const promise = createProject({ title: 'Proyecto', brand_id: 2, manager_id: 3 });

    await expect(promise).rejects.toMatchObject({
      name: 'DomainError',
      code: 'MANAGER_NOT_BRAND_MANAGER',
      message: 'El gerente del proyecto debe ser el gerente de su marca principal',
    });
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(mockTransaction.execute).not.toHaveBeenCalled();
  });

  it('S5: createProject rechaza el proyecto si la marca principal no tiene gerente', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ client_id: 7, manager_id: null }]));

    await expect(
      createProject({ title: 'Proyecto', brand_id: 2, manager_id: 3 })
    ).rejects.toMatchObject({ code: 'MANAGER_NOT_BRAND_MANAGER' });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('S5: lee el gerente de la marca principal junto a su cliente', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ client_id: 7, manager_id: 4 }]));

    await expect(
      createProject({ title: 'Proyecto', brand_id: 2, manager_id: 3 })
    ).rejects.toMatchObject({ code: 'MANAGER_NOT_BRAND_MANAGER' });

    const lookup = mockExecute.mock.calls[0][0] as { sql: string; args: unknown[] };
    expect(lookup.sql).toBe('SELECT client_id, manager_id FROM brands WHERE id = $1');
    expect(lookup.args).toEqual([2]);
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

describe('gerente al crearse (created_manager_id)', () => {
  // Spec: odd/tasks/brand-owned-project-manager.md — S7, S8

  it('S7: createProject guarda created_manager_id igual a manager_id', async () => {
    mockTransaction.execute.mockResolvedValueOnce(makeResult([{ id: 15 }]));
    mockExecute
      .mockResolvedValueOnce(makeResult([{ client_id: 7, manager_id: 3 }]))
      .mockResolvedValueOnce(makeResult([{ client_id: 7 }]))
      .mockResolvedValueOnce(makeResult([{ id: 15 }]));

    await createProject({ title: 'Proyecto', brand_id: 2, manager_id: 3 });

    const insert = mockTransaction.execute.mock.calls[0][0] as { sql: string; args: unknown[] };
    expect(insert.sql.replace(/\s+/g, ' ')).toContain(
      'INSERT INTO projects (title, brand_id, manager_id, created_manager_id, client_id,'
    );
    expect(insert.sql).toContain('$15');
    expect(insert.args).toHaveLength(15);
    expect(insert.args.slice(0, 5)).toEqual(['Proyecto', 2, 3, 3, 7]);
  });

  it('S8: getProjectById devuelve created_manager_id y created_manager_name', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 1 }]));

    await getProjectById(1);

    const sql = (mockExecute.mock.calls[0]?.[0] as { sql: string }).sql;
    expect(sql).toContain('p.created_manager_id');
    expect(sql).toContain('cm.name          AS created_manager_name');
    expect(sql).toContain('LEFT JOIN managers         cm  ON p.created_manager_id = cm.id');
    // El gerente actual sigue saliendo de manager_id
    expect(sql).toContain('LEFT JOIN managers         m   ON p.manager_id  = m.id');
  });

  it('S8: el listado paginado también incluye el gerente al crearse', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 0 }]))
      .mockResolvedValueOnce(makeResult([]));

    await getProjectsWithPagination({});

    const listSql = (mockExecute.mock.calls[1]?.[0] as { sql: string }).sql;
    expect(listSql).toContain('AS created_manager_name');
    expect(listSql).toContain('ON p.created_manager_id = cm.id');
  });

  it('S7: la cascada de marca mueve manager_id pero nunca escribe created_manager_id', async () => {
    mockTransaction.execute.mockResolvedValueOnce(
      makeResult([{ id: 30, manager_id: 7 }])
    );

    const moved = await cascadeBrandManagerToProjects(
      mockTransaction as never,
      4,
      11,
      77,
      'Traslado'
    );

    expect(moved).toEqual([30]);
    const calls = mockTransaction.execute.mock.calls.map((c) => c[0] as { sql: string; args: unknown[] });
    expect(calls.find((c) => c.sql.includes('UPDATE projects'))?.sql).toBe(
      'UPDATE projects SET manager_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2'
    );
    expect(calls.some((c) => c.sql.includes('created_manager_id'))).toBe(false);
  });

  it('S7: updateProject ignora created_manager_id aunque llegue en el payload', async () => {
    const current = { id: 9, status: 'active', manager_id: 3, client_id: 7 };
    mockExecute
      .mockResolvedValueOnce(makeResult([current]))
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([current]));

    await updateProject(9, { title: 'Nuevo', created_manager_id: 12 } as never);

    const update = mockExecute.mock.calls[1][0] as { sql: string; args: unknown[] };
    expect(update.sql).toBe('UPDATE projects SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2');
    expect(update.args).toEqual(['Nuevo', 9]);
  });
});
