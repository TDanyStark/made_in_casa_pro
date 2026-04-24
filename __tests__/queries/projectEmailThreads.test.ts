jest.mock('@/lib/db', () => ({
  db: {
    execute: jest.fn(),
  },
}));

import { db } from '@/lib/db';
import {
  buildThreadKey,
  getOrCreateThread,
  updateThreadExternalIds,
  getThreadsByProject,
  getThreadByKey,
} from '@/lib/queries/projectEmailThreads';

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

describe('buildThreadKey()', () => {
  it('builds key with base for project without adjustment', () => {
    const key = buildThreadKey(15, null);
    expect(key).toBe('project:15:version:base');
  });

  it('builds key with adjustment id when provided', () => {
    const key = buildThreadKey(15, 3);
    expect(key).toBe('project:15:version:adjustment-3');
  });
});

describe('getOrCreateThread()', () => {
  it('returns existing thread if found', async () => {
    const existing = {
      id: 5, project_id: 15, adjustment_id: null, thread_key: 'project:15:version:base',
      provider: 'gmail', gmail_thread_id: 'thread-abc', root_message_id: null,
      created_by_user_id: 3, created_at: '2026-01-01', updated_at: '2026-01-01',
    };
    mockExecute.mockResolvedValueOnce(makeResult([existing]));
    const result = await getOrCreateThread({ project_id: 15 });
    expect(result.id).toBe(5);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('creates new thread if not found', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([{
        id: 6, project_id: 15, adjustment_id: null, thread_key: 'project:15:version:base',
        provider: 'gmail', gmail_thread_id: null, root_message_id: null,
        created_by_user_id: null, created_at: '2026-01-01', updated_at: '2026-01-01',
      }]));
    const result = await getOrCreateThread({ project_id: 15 });
    expect(result.id).toBe(6);
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it('uses provided thread_key over generated one', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([{
        id: 7, project_id: 15, adjustment_id: 3, thread_key: 'custom-key',
        provider: 'gmail', gmail_thread_id: null, root_message_id: null,
        created_by_user_id: null, created_at: '2026-01-01', updated_at: '2026-01-01',
      }]));
    await getOrCreateThread({ project_id: 15, adjustment_id: 3, thread_key: 'custom-key' });
    const insertCall = mockExecute.mock.calls[1];
    expect(insertCall[0]).toEqual(expect.objectContaining({
      args: expect.arrayContaining(['custom-key']),
    }));
  });

  it('defaults to gmail provider', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([{
        id: 8, project_id: 15, adjustment_id: null, thread_key: 'project:15:version:base',
        provider: 'gmail', gmail_thread_id: null, root_message_id: null,
        created_by_user_id: null, created_at: '2026-01-01', updated_at: '2026-01-01',
      }]));
    const result = await getOrCreateThread({ project_id: 15 });
    expect(result.provider).toBe('gmail');
  });
});

describe('updateThreadExternalIds()', () => {
  it('updates gmail_thread_id and root_message_id', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await updateThreadExternalIds(5, { gmail_thread_id: 'thread-xyz', root_message_id: 'root-msg' });
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('gmail_thread_id = COALESCE($2, gmail_thread_id)'),
      args: [5, 'thread-xyz', 'root-msg'],
    }));
  });

  it('uses COALESCE to preserve existing values', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await updateThreadExternalIds(5, {});
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      args: [5, null, null],
    }));
  });
});

describe('getThreadsByProject()', () => {
  it('returns threads ordered by created_at ASC', async () => {
    const threads = [
      { id: 1, project_id: 15, adjustment_id: null, thread_key: 'project:15:version:base', provider: 'gmail', gmail_thread_id: null, root_message_id: null, created_by_user_id: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];
    mockExecute.mockResolvedValueOnce(makeResult(threads));
    const result = await getThreadsByProject(15);
    expect(result).toHaveLength(1);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('ORDER BY created_at ASC'),
      args: [15],
    }));
  });

  it('returns empty array on error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    const result = await getThreadsByProject(15);
    expect(result).toEqual([]);
  });
});

describe('getThreadByKey()', () => {
  it('returns thread when found', async () => {
    const thread = {
      id: 5, project_id: 15, adjustment_id: null, thread_key: 'project:15:version:base',
      provider: 'gmail', gmail_thread_id: 'thread-abc', root_message_id: null,
      created_by_user_id: 3, created_at: '2026-01-01', updated_at: '2026-01-01',
    };
    mockExecute.mockResolvedValueOnce(makeResult([thread]));
    const result = await getThreadByKey('project:15:version:base');
    expect(result?.gmail_thread_id).toBe('thread-abc');
  });

  it('returns null when not found', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    const result = await getThreadByKey('nonexistent-key');
    expect(result).toBeNull();
  });

  it('returns null on error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    const result = await getThreadByKey('any-key');
    expect(result).toBeNull();
  });
});