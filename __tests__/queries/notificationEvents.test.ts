jest.mock('@/lib/db', () => ({
  db: {
    execute: jest.fn(),
  },
}));

import { db } from '@/lib/db';
import {
  createNotificationEvent,
  getNotificationEventsByProject,
  getNotificationEventsByTask,
} from '@/lib/queries/notificationEvents';

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
});

describe('createNotificationEvent()', () => {
  it('inserts event with all provided fields', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 1, event_type: 'task.assigned', project_id: 10, task_id: 5,
      adjustment_id: null, actor_user_id: 3, metadata: null,
      created_at: '2026-01-01',
    }]));
    const result = await createNotificationEvent({
      event_type: 'task.assigned',
      project_id: 10,
      task_id: 5,
      actor_user_id: 3,
    });
    expect(result.event_type).toBe('task.assigned');
    expect(result.project_id).toBe(10);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('INSERT INTO notification_events'),
    }));
  });

  it('serializes metadata as JSON string', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 2, event_type: 'task.completed', project_id: 10, task_id: 5,
      adjustment_id: null, actor_user_id: 3,
      metadata: { previous_status: 'in_progress' },
      created_at: '2026-01-01',
    }]));
    const meta = { previous_status: 'in_progress' };
    await createNotificationEvent({
      event_type: 'task.completed',
      project_id: 10,
      task_id: 5,
      metadata: meta,
    });
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      args: expect.arrayContaining([JSON.stringify(meta)]),
    }));
  });

  it('omits optional fields when not provided', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 3, event_type: 'project.completed', project_id: 10, task_id: null,
      adjustment_id: null, actor_user_id: null, metadata: null,
      created_at: '2026-01-01',
    }]));
    const result = await createNotificationEvent({
      event_type: 'project.completed',
      project_id: 10,
    });
    expect(result.task_id).toBeNull();
  });
});

describe('getNotificationEventsByProject()', () => {
  it('returns events ordered by created_at DESC with limit', async () => {
    const events = [
      { id: 2, event_type: 'task.completed', project_id: 10, task_id: 5, adjustment_id: null, actor_user_id: 3, metadata: null, created_at: '2026-01-02' },
      { id: 1, event_type: 'task.assigned', project_id: 10, task_id: 5, adjustment_id: null, actor_user_id: 3, metadata: null, created_at: '2026-01-01' },
    ];
    mockExecute.mockResolvedValueOnce(makeResult(events));
    const result = await getNotificationEventsByProject(10);
    expect(result).toHaveLength(2);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('ORDER BY created_at DESC'),
      args: [10, 50],
    }));
  });

  it('uses custom limit when provided', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await getNotificationEventsByProject(10, 10);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      args: [10, 10],
    }));
  });

  it('returns empty array on error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    const result = await getNotificationEventsByProject(10);
    expect(result).toEqual([]);
  });
});

describe('getNotificationEventsByTask()', () => {
  it('returns events for a specific task', async () => {
    const events = [
      { id: 1, event_type: 'task.assigned', project_id: 10, task_id: 5, adjustment_id: null, actor_user_id: 3, metadata: null, created_at: '2026-01-01' },
    ];
    mockExecute.mockResolvedValueOnce(makeResult(events));
    const result = await getNotificationEventsByTask(5);
    expect(result).toHaveLength(1);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('WHERE task_id = $1'),
      args: [5],
    }));
  });

  it('returns empty array on error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    const result = await getNotificationEventsByTask(5);
    expect(result).toEqual([]);
  });
});