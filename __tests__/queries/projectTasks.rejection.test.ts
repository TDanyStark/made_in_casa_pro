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

import { db } from '@/lib/db';
import {
  createRejectionLoopTasks,
  validateTask,
  completeTask,
} from '@/lib/queries/projectTasks';

const mockExecute = db.execute as jest.MockedFunction<typeof db.execute>;

function makeResult(rows: Record<string, unknown>[], rowsAffected?: number) {
  return {
    rows: rows as never,
    columns: [] as string[],
    columnTypes: [] as string[],
    rowsAffected: rowsAffected ?? rows.length,
    toJSON: () => ({}),
  };
}

// A full task row matching ProjectTaskType shape
function makeTaskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    project_id: 1,
    template_id: null,
    title: 'Review Work',
    description: null,
    area_id: 2,
    area_name: 'Design',
    assigned_user_id: 5,
    assigned_user_name: 'Alice',
    assigned_user_rol_id: 4,
    status: 'in_progress',
    task_type: 'validation',
    task_flag: 'new',
    requires_quote: 0,
    assign_to_commercial: 0,
    order_index: 3,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    quote_count: 0,
    pending_quote_count: 0,
    ...overrides,
  };
}

// Target task M shape (execution task to be cloned)
function makeTargetTaskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    project_id: 1,
    template_id: 42,
    title: 'Do the Work',
    description: 'Some description',
    area_id: 2,
    area_name: 'Design',
    assigned_user_id: 6,
    assigned_user_name: 'Bob',
    assigned_user_rol_id: 4,
    status: 'completed',
    task_type: 'execution',
    task_flag: 'new',
    requires_quote: 1,
    assign_to_commercial: 1,
    order_index: 2,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    quote_count: 0,
    pending_quote_count: 0,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.execute.mockReset();
  mockTransaction.commit.mockReset();
  mockTransaction.rollback.mockReset();
  // Default: commit resolves immediately
  mockTransaction.commit.mockResolvedValue(undefined);
  mockTransaction.rollback.mockResolvedValue(undefined);
});

// ─── 5.1: createRejectionLoopTasks creates 2 new tasks with correct fields ───

describe('createRejectionLoopTasks()', () => {
  it('5.1 — calls transaction.execute to shift order_index for tasks after N', async () => {
    // Step 1: db.execute returns task N (validation at order_index=3)
    // Step 1: db.execute returns task M (target at order_index=2)
    // Step 2: db.execute returns range [M, N] (K=2)
    mockExecute
      .mockResolvedValueOnce(makeResult([{ id: 10, order_index: 3, task_flag: 'new', status: 'in_progress' }]))
      .mockResolvedValueOnce(makeResult([{ id: 7, order_index: 2 }]))
      .mockResolvedValueOnce(makeResult([
        makeTargetTaskRow({ id: 7, order_index: 2 }), // task M
        makeTaskRow({ id: 10, order_index: 3 }),       // task N
      ]));

    // transaction.execute calls (K=2):
    // 1. shift order_index UPDATE (+K=2)
    // 2. INSERT N+1 (clone of M) -> returns 101
    // 3. Transition N+1 (null -> not_started)
    // 4. INSERT N+2 (clone of N) -> returns 102
    // 5. Transition N+2 (null -> waiting)
    // 6. UPDATE task N to completed
    // 7. Transition task N (in_progress -> completed)
    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([]))            // shift
      .mockResolvedValueOnce(makeResult([{ id: 101 }])) // INSERT N+1
      .mockResolvedValueOnce(makeResult([]))            // transition N+1
      .mockResolvedValueOnce(makeResult([{ id: 102 }])) // INSERT N+2
      .mockResolvedValueOnce(makeResult([]))            // transition N+2
      .mockResolvedValueOnce(makeResult([]))            // UPDATE N
      .mockResolvedValueOnce(makeResult([]));           // transition N

    // getProjectTaskById called for firstCorrectionTask (101)
    mockExecute
      .mockResolvedValueOnce(makeResult([makeTaskRow({ id: 101, order_index: 4, task_flag: 'correction', status: 'not_started' })]));

    await createRejectionLoopTasks(1, 10, 7, 5, 'needs fixes');

    // Verify shift query was called with correct project_id and order_index
    expect(mockTransaction.execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('order_index = order_index + $1'),
      args: expect.arrayContaining([2, 1, 3]),  // K=2, projectId=1, N.order_index=3
    }));
  });

  it('5.1 — inserts correction task N+1 at order_index N+1 with flag=correction and status=not_started', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ id: 10, order_index: 3, task_flag: 'new', status: 'in_progress' }]))
      .mockResolvedValueOnce(makeResult([{ id: 7, order_index: 2 }]))
      .mockResolvedValueOnce(makeResult([
        makeTargetTaskRow({ id: 7, order_index: 2 }),
        makeTaskRow({ id: 10, order_index: 3 }),
      ]));

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([]))            // shift
      .mockResolvedValueOnce(makeResult([{ id: 101 }])) // INSERT N+1
      .mockResolvedValueOnce(makeResult([]))            // transition N+1
      .mockResolvedValueOnce(makeResult([{ id: 102 }])) // INSERT N+2
      .mockResolvedValueOnce(makeResult([]))            // transition N+2
      .mockResolvedValueOnce(makeResult([]))            // UPDATE N
      .mockResolvedValueOnce(makeResult([]));           // transition N

    mockExecute
      .mockResolvedValueOnce(makeResult([makeTaskRow({ id: 101, order_index: 4 })]));

    await createRejectionLoopTasks(1, 10, 7, 5);

    // The second transaction.execute call is INSERT N+1 with order_index=4 (3+1) and projectId=1
    // (Note: we check if it contains correction flag and correct order_index)
    expect(mockTransaction.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      sql: expect.stringContaining("'correction'"),
      args: expect.arrayContaining([1, 4]),  // projectId=1, order_index=N+1=4
    }));
  });

  it('5.1 — inserts re-validation task N+2 at order_index N+2 (clone of N) with status=waiting and flag=correction', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ id: 10, order_index: 3, task_flag: 'new', status: 'in_progress' }]))
      .mockResolvedValueOnce(makeResult([{ id: 7, order_index: 2 }]))
      .mockResolvedValueOnce(makeResult([
        makeTargetTaskRow({ id: 7, order_index: 2 }),
        makeTaskRow({ id: 10, order_index: 3 }),
      ]));

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([]))            // shift
      .mockResolvedValueOnce(makeResult([{ id: 101 }])) // INSERT N+1
      .mockResolvedValueOnce(makeResult([]))            // transition N+1
      .mockResolvedValueOnce(makeResult([{ id: 102 }])) // INSERT N+2
      .mockResolvedValueOnce(makeResult([]))            // transition N+2
      .mockResolvedValueOnce(makeResult([]))            // UPDATE N
      .mockResolvedValueOnce(makeResult([]));           // transition N

    mockExecute
      .mockResolvedValueOnce(makeResult([makeTaskRow({ id: 101, order_index: 4 })]));

    await createRejectionLoopTasks(1, 10, 7, 5);

    // Fourth transaction.execute call: INSERT N+2 with order_index=5 (3+2) and status=waiting
    expect(mockTransaction.execute).toHaveBeenNthCalledWith(4, expect.objectContaining({
      sql: expect.stringContaining("'correction'"),
      args: expect.arrayContaining([5, 'waiting']),  // order_index=N+2=5, status=waiting
    }));
  });

  it('5.1 — marks task N as completed inside the transaction', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ id: 10, order_index: 3, task_flag: 'new', status: 'in_progress' }]))
      .mockResolvedValueOnce(makeResult([{ id: 7, order_index: 2 }]))
      .mockResolvedValueOnce(makeResult([
        makeTargetTaskRow({ id: 7, order_index: 2 }),
        makeTaskRow({ id: 10, order_index: 3 }),
      ]));

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([]))            // shift
      .mockResolvedValueOnce(makeResult([{ id: 101 }])) // INSERT N+1
      .mockResolvedValueOnce(makeResult([]))            // transition N+1
      .mockResolvedValueOnce(makeResult([{ id: 102 }])) // INSERT N+2
      .mockResolvedValueOnce(makeResult([]))            // transition N+2
      .mockResolvedValueOnce(makeResult([]))            // UPDATE N
      .mockResolvedValueOnce(makeResult([]));           // transition N

    mockExecute
      .mockResolvedValueOnce(makeResult([makeTaskRow({ id: 101 })]));

    await createRejectionLoopTasks(1, 10, 7, 5);

    // Sixth transaction.execute: UPDATE task N to completed
    expect(mockTransaction.execute).toHaveBeenNthCalledWith(6, expect.objectContaining({
      sql: expect.stringContaining("status = 'completed'"),
      args: expect.arrayContaining([10]),  // taskId = N = 10
    }));
  });

  it('5.1 — commits the transaction on success', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ id: 10, order_index: 3, task_flag: 'new', status: 'in_progress' }]))
      .mockResolvedValueOnce(makeResult([{ id: 7, order_index: 2 }]))
      .mockResolvedValueOnce(makeResult([
        makeTargetTaskRow({ id: 7, order_index: 2 }),
        makeTaskRow({ id: 10, order_index: 3 }),
      ]));

    mockTransaction.execute
      .mockResolvedValue(makeResult([{ id: 99 }]));

    mockExecute
      .mockResolvedValueOnce(makeResult([makeTaskRow({ id: 99 })]));

    await createRejectionLoopTasks(1, 10, 7, 5);

    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  // ─── 5.2: throws if task N doesn't exist ────────────────────────────────────

  it('5.2 — throws "Tarea de validación no encontrada" when task N does not exist', async () => {
    // Task N not found (empty result)
    mockExecute
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([{ id: 7, order_index: 2 }]));

    await expect(createRejectionLoopTasks(1, 99, 7, 5)).rejects.toThrow('Tarea de validación no encontrada');
  });

  // ─── 5.3: throws if task M doesn't exist ────────────────────────────────────

  it('5.3 — throws "Tarea destino no encontrada" when task M does not exist', async () => {
    // Task N found, task M not found
    mockExecute
      .mockResolvedValueOnce(makeResult([{ id: 10, order_index: 3, task_flag: 'new', status: 'in_progress' }]))
      .mockResolvedValueOnce(makeResult([]));  // Task M not found

    await expect(createRejectionLoopTasks(1, 10, 99, 5)).rejects.toThrow('Tarea destino no encontrada');
  });
});

// ─── 5.4: Immutability guard in validateTask ────────────────────────────────

describe('validateTask() — immutability guard', () => {
  it('5.4 — throws when task status is already "completed"', async () => {
    // getProjectTaskById returns a completed task
    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({ status: 'completed' })]));

    await expect(validateTask(10, 5, 'approve')).rejects.toThrow(
      'Esta tarea ya está completada y no puede modificarse'
    );
  });

  it('5.4 — does NOT throw when task status is "in_progress"', async () => {
    // getProjectTaskById returns an in_progress task
    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({ status: 'in_progress', task_type: 'validation' })]));

    // completeTask also calls getProjectTaskById, set up transaction
    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({ status: 'in_progress', task_type: 'execution' })]));
    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([]))    // UPDATE completed
      .mockResolvedValueOnce(makeResult([]))    // INSERT transition
      .mockResolvedValueOnce(makeResult([]));   // next task query (empty)
    mockExecute
      .mockResolvedValueOnce(makeResult([makeTaskRow({ status: 'completed' })]));  // updated task

    // Should not throw the immutability error
    await expect(validateTask(10, 5, 'approve')).resolves.toBeDefined();
  });
});

// ─── 5.5: Immutability guard in completeTask ────────────────────────────────

describe('completeTask() — immutability guard', () => {
  it('5.5 — throws when task status is already "completed"', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({
      status: 'completed',
      task_type: 'execution',
    })]));

    await expect(completeTask(10, 5)).rejects.toThrow(
      'Esta tarea ya está completada y no puede modificarse'
    );
  });

  it('5.5 — throws correct message (not a generic error)', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({
      status: 'completed',
      task_type: 'execution',
    })]));

    const err = await completeTask(10, 5).catch(e => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Esta tarea ya está completada y no puede modificarse');
  });
});
