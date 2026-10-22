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
  it('returns the id of the waiting task promoted to not_started and not the demoted one', async () => {
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
      .mockResolvedValueOnce(makeResult([])) // UPDATE promote id=2
      .mockResolvedValueOnce(makeResult([])); // UPDATE demote id=1

    await expect(reorderProjectTasks(1, [2, 1], 9)).resolves.toEqual([2]);
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
