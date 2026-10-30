/**
 * Tests for reorderProjectTasks() return value: the ids of the tasks that the
 * pending-task promotion activated ('waiting' → 'not_started'), so the API
 * layer can send task.ready. Demoted tasks are never reported.
 */

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
import { reorderProjectTasks } from '@/lib/queries/projectTasks';

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

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.execute.mockReset();
  mockTransaction.commit.mockResolvedValue(undefined);
  mockTransaction.rollback.mockResolvedValue(undefined);
});

describe('reorderProjectTasks() activated ids', () => {
  it('S4: promotes the waiting task moved first and keeps the other not_started task active', async () => {
    // getTasksByProject: current tasks (none completed)
    mockExecute.mockResolvedValueOnce(
      makeResult([
        { id: 1, status: 'not_started', order_index: 0 },
        { id: 2, status: 'waiting', order_index: 1 },
      ])
    );

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([])) // UPDATE order id=2 -> 0
      .mockResolvedValueOnce(makeResult([])) // UPDATE order id=1 -> 1
      .mockResolvedValueOnce(
        makeResult([
          { id: 2, status: 'waiting', assigned_user_id: 8 },
          { id: 1, status: 'not_started', assigned_user_id: 5 },
        ])
      ) // SELECT ordered tasks
      .mockResolvedValueOnce(makeResult([])); // UPDATE promote id=2

    await expect(reorderProjectTasks(1, [2, 1], 9)).resolves.toEqual([2]);
    const demotions = mockTransaction.execute.mock.calls.filter(([q]) => /status = 'waiting'/.test(q.sql));
    expect(demotions).toHaveLength(0);
    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  it('returns an empty list when the first pending task was already active', async () => {
    mockExecute.mockResolvedValueOnce(
      makeResult([
        { id: 1, status: 'not_started', order_index: 0 },
        { id: 2, status: 'waiting', order_index: 1 },
      ])
    );

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(
        makeResult([
          { id: 1, status: 'not_started', assigned_user_id: 5 },
          { id: 2, status: 'waiting', assigned_user_id: 8 },
        ])
      );

    await expect(reorderProjectTasks(1, [1, 2], 9)).resolves.toEqual([]);
  });
});

// S44 (2.3): the ordered list must contain every task of the version exactly once.
describe('reorderProjectTasks() list completeness', () => {
  const current = [
    { id: 1, status: 'not_started', order_index: 0 },
    { id: 2, status: 'waiting', order_index: 1 },
    { id: 3, status: 'waiting', order_index: 2 },
  ];

  it.each([
    ['a partial list', [3, 1]],
    ['a repeated id', [3, 1, 1]],
    ['an id from outside the version', [3, 2, 9]],
  ])('rejects %s with a 400 rule error and writes nothing', async (_label, orderedIds) => {
    mockExecute.mockResolvedValueOnce(makeResult(current));

    await expect(reorderProjectTasks(15, orderedIds, 4)).rejects.toMatchObject({
      name: 'TaskRuleError',
      status: 400,
      message: 'La lista debe incluir todas las tareas de la versión, una sola vez',
    });
    expect(db.transaction).not.toHaveBeenCalled();
    expect(mockTransaction.execute).not.toHaveBeenCalled();
  });
});

// Completed tasks can be reordered like any other task; the pending-task
// promotion still skips them.
describe('reorderProjectTasks() completed tasks', () => {
  it('moves a completed task to a new position and saves the order', async () => {
    mockExecute.mockResolvedValueOnce(
      makeResult([
        { id: 1, status: 'not_started', order_index: 0 },
        { id: 2, status: 'completed', order_index: 1 },
        { id: 3, status: 'completed', order_index: 2 },
        { id: 4, status: 'waiting', order_index: 3 },
      ])
    );

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(
        makeResult([
          { id: 2, status: 'completed', assigned_user_id: 5 },
          { id: 3, status: 'completed', assigned_user_id: 5 },
          { id: 1, status: 'not_started', assigned_user_id: 5 },
          { id: 4, status: 'waiting', assigned_user_id: 8 },
        ])
      );

    await expect(reorderProjectTasks(1, [2, 3, 1, 4], 9)).resolves.toEqual([]);
    const orderUpdates = mockTransaction.execute.mock.calls
      .filter(([q]) => /SET order_index/.test(q.sql))
      .map(([q]) => [q.args[0], q.args[1]]);
    expect(orderUpdates).toEqual([[0, 2], [1, 3], [2, 1], [3, 4]]);
    expect(mockTransaction.commit).toHaveBeenCalled();
  });
});
