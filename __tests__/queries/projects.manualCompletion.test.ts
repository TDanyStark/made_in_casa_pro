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
import { revalidatePath } from 'next/cache';
import { completeProject } from '@/lib/queries/projects';

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

type Query = { sql: string; args: unknown[] };
const txQueries = () => mockTransaction.execute.mock.calls.map(([q]) => q as Query);
const writes = () => txQueries().filter((q) => /^\s*UPDATE/i.test(q.sql));

/** Queue: project row, latest version row, latest-version task counts. */
function queue(project: Record<string, unknown> | null, versionId: number | null, total = 0, completed = 0) {
  mockTransaction.execute.mockResolvedValueOnce(makeResult(project ? [project] : []));
  if (!project) return;
  mockTransaction.execute.mockResolvedValueOnce(makeResult(versionId ? [{ id: versionId }] : []));
  if (!versionId) return;
  mockTransaction.execute.mockResolvedValueOnce(
    makeResult([{ total: String(total), completed: String(completed) }])
  );
}

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

describe('completeProject (manual fallback)', () => {
  it('closes a stale in_adjustments project whose latest-version tasks are all finished', async () => {
    queue({ status: 'in_adjustments', progress: 80 }, 70, 4, 4);

    await expect(completeProject(33)).resolves.toBeUndefined();

    expect(db.transaction).toHaveBeenCalledWith('write');
    expect(mockExecute).not.toHaveBeenCalled();
    const [projectLock, versionLock, counts] = txQueries();
    expect(projectLock.sql).toMatch(/FROM projects WHERE id = \$1 FOR UPDATE/);
    expect(projectLock.args).toEqual([33]);
    expect(versionLock.sql).toMatch(/FROM project_adjustments[\s\S]*version_number DESC[\s\S]*LIMIT 1 FOR UPDATE/);
    expect(versionLock.sql).not.toContain("status = 'active'");
    expect(versionLock.args).toEqual([33]);
    expect(counts.sql).toMatch(/FROM project_tasks WHERE project_id = \$1 AND adjustment_id = \$2/);
    expect(counts.args).toEqual([33, 70]);

    const [projectUpdate, versionUpdate, ...rest] = writes();
    expect(rest).toHaveLength(0);
    expect(projectUpdate.sql).toMatch(/UPDATE projects SET progress = 100, status = 'completed'/);
    expect(projectUpdate.sql).toMatch(/completed_at = COALESCE\(completed_at, CURRENT_TIMESTAMP\)/);
    expect(projectUpdate.args).toEqual([33]);
    expect(versionUpdate.sql).toMatch(/UPDATE project_adjustments SET status = 'completed'/);
    expect(versionUpdate.sql).toMatch(/WHERE id = \$1$/m);
    expect(versionUpdate.args).toEqual([70]);
    expect(txQueries().some((q) => /project_tasks/.test(q.sql) && /UPDATE/i.test(q.sql))).toBe(false);

    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockTransaction.rollback).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/projects/33');
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
  });

  it('rejects a stale progress=100 project with unfinished latest-version tasks and writes nothing', async () => {
    queue({ status: 'active', progress: 100 }, 70, 5, 4);

    await expect(completeProject(33)).rejects.toThrow('El proyecto no tiene todas las tareas completadas');

    expect(writes()).toHaveLength(0);
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an empty latest version', async () => {
    queue({ status: 'active', progress: 100 }, 70, 0, 0);

    await expect(completeProject(33)).rejects.toThrow('El proyecto no tiene todas las tareas completadas');
    expect(writes()).toHaveLength(0);
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  it('rejects a project without versions', async () => {
    queue({ status: 'active', progress: 100 }, null);

    await expect(completeProject(33)).rejects.toThrow('El proyecto no tiene todas las tareas completadas');
    expect(writes()).toHaveLength(0);
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
  });

  it('rejects a missing project', async () => {
    queue(null, null);

    await expect(completeProject(33)).rejects.toThrow('Proyecto no encontrado');
    expect(writes()).toHaveLength(0);
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  it('keeps rejecting an already completed project', async () => {
    queue({ status: 'completed', progress: 100 }, 70, 4, 4);

    await expect(completeProject(33)).rejects.toThrow('El proyecto ya está completado');
    expect(writes()).toHaveLength(0);
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
  });

  it('rolls back when the version update fails', async () => {
    queue({ status: 'in_adjustments', progress: 80 }, 70, 4, 4);
    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([]))
      .mockRejectedValueOnce(new Error('version update failed'));

    await expect(completeProject(33)).rejects.toThrow('version update failed');
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
