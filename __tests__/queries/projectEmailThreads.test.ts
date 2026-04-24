jest.mock('@/lib/db', () => ({
  db: {
    execute: jest.fn(),
  },
}));

import { db } from '@/lib/db';
import {
  buildThreadKey,
  resolveProjectVersionThreadKey,
  getThreadByProjectVersion,
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
  it('builds v1 key for a new project', () => {
    const key = buildThreadKey(15);
    expect(key).toBe('project:15:version:v1');
  });

  it('builds key with explicit version number', () => {
    const key = buildThreadKey(15, 3);
    expect(key).toBe('project:15:version:v3');
  });
});

describe('resolveProjectVersionThreadKey()', () => {
  it('resolves v1 when there is no adjustment id', async () => {
    await expect(resolveProjectVersionThreadKey(15, null)).resolves.toBe('project:15:version:v1');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('resolves adjustment version number from the database', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ version_number: 2 }]));

    await expect(resolveProjectVersionThreadKey(15, 9)).resolves.toBe('project:15:version:v2');
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({ args: [9, 15] }));
  });
});

describe('getThreadByProjectVersion()', () => {
  it('looks up the base thread using the generated base thread key', async () => {
    const thread = {
      id: 5, project_id: 15, adjustment_id: null, thread_key: 'project:15:version:v1',
      provider: 'gmail', gmail_thread_id: 'thread-abc', root_message_id: null,
      created_by_user_id: 3, created_at: '2026-01-01', updated_at: '2026-01-01',
    };
    mockExecute.mockResolvedValueOnce(makeResult([thread]));

    const result = await getThreadByProjectVersion(15, null);

    expect(result?.thread_key).toBe('project:15:version:v1');
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      args: [15, 'project:15:version:v1'],
    }));
  });

  it('looks up adjustment threads using the generated adjustment thread key', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ version_number: 3 }])).mockResolvedValueOnce(makeResult([]));

    const result = await getThreadByProjectVersion(15, 3);

    expect(result).toBeNull();
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      args: [15, 'project:15:version:v3'],
    }));
  });
});

describe('getOrCreateThread()', () => {
  it('upserts and returns the base project thread idempotently', async () => {
    const existing = {
      id: 5, project_id: 15, adjustment_id: null, thread_key: 'project:15:version:v1',
      provider: 'gmail', gmail_thread_id: 'thread-abc', root_message_id: null,
      created_by_user_id: 3, created_at: '2026-01-01', updated_at: '2026-01-01',
    };
    mockExecute.mockResolvedValueOnce(makeResult([existing]));

    const result = await getOrCreateThread({ project_id: 15 });

    expect(result.id).toBe(5);
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('ON CONFLICT (project_id, thread_key) WHERE adjustment_id IS NULL'),
      args: [15, null, 'project:15:version:v1', 'gmail', null],
    }));
  });

  it('upserts and returns an adjustment project thread idempotently', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ version_number: 3 }])).mockResolvedValueOnce(makeResult([{
        id: 6, project_id: 15, adjustment_id: 3, thread_key: 'project:15:version:v3',
        provider: 'gmail', gmail_thread_id: null, root_message_id: null,
        created_by_user_id: null, created_at: '2026-01-01', updated_at: '2026-01-01',
      }]));

    const result = await getOrCreateThread({ project_id: 15, adjustment_id: 3 });

    expect(result.id).toBe(6);
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(mockExecute.mock.calls[1][0]).toEqual(expect.objectContaining({
      sql: expect.stringContaining('ON CONFLICT (project_id, adjustment_id, thread_key) WHERE adjustment_id IS NOT NULL'),
      args: [15, 3, 'project:15:version:v3', 'gmail', null],
    }));
  });

  it('uses provided thread_key over generated one', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
        id: 7, project_id: 15, adjustment_id: 3, thread_key: 'custom-key',
        provider: 'gmail', gmail_thread_id: null, root_message_id: null,
        created_by_user_id: null, created_at: '2026-01-01', updated_at: '2026-01-01',
      }]));

    await getOrCreateThread({ project_id: 15, adjustment_id: 3, thread_key: 'custom-key' });

    const insertCall = mockExecute.mock.calls[0];
    expect(insertCall[0]).toEqual(expect.objectContaining({
      args: expect.arrayContaining(['custom-key']),
    }));
  });

  it('defaults to gmail provider', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
        id: 8, project_id: 15, adjustment_id: null, thread_key: 'project:15:version:v1',
        provider: 'gmail', gmail_thread_id: null, root_message_id: null,
        created_by_user_id: null, created_at: '2026-01-01', updated_at: '2026-01-01',
      }]));

    const result = await getOrCreateThread({ project_id: 15 });

    expect(result.provider).toBe('gmail');
  });

  it('generates distinct thread keys for base and adjustment versions', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{
        id: 1, project_id: 15, adjustment_id: null, thread_key: 'project:15:version:v1',
        provider: 'gmail', gmail_thread_id: null, root_message_id: null,
        created_by_user_id: null, created_at: '2026-01-01', updated_at: '2026-01-01',
      }]))
      .mockResolvedValueOnce(makeResult([{ version_number: 3 }]))
      .mockResolvedValueOnce(makeResult([{
        id: 2, project_id: 15, adjustment_id: 3, thread_key: 'project:15:version:v3',
        provider: 'gmail', gmail_thread_id: null, root_message_id: null,
        created_by_user_id: null, created_at: '2026-01-01', updated_at: '2026-01-01',
      }]));

    await getOrCreateThread({ project_id: 15 });
    await getOrCreateThread({ project_id: 15, adjustment_id: 3 });

    expect(mockExecute.mock.calls[0][0]).toEqual(expect.objectContaining({
      args: expect.arrayContaining(['project:15:version:v1']),
    }));
    expect(mockExecute.mock.calls[2][0]).toEqual(expect.objectContaining({
      args: expect.arrayContaining(['project:15:version:v3']),
    }));
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
      { id: 1, project_id: 15, adjustment_id: null, thread_key: 'project:15:version:v1', provider: 'gmail', gmail_thread_id: null, root_message_id: null, created_by_user_id: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
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
      id: 5, project_id: 15, adjustment_id: null, thread_key: 'project:15:version:v1',
      provider: 'gmail', gmail_thread_id: 'thread-abc', root_message_id: null,
      created_by_user_id: 3, created_at: '2026-01-01', updated_at: '2026-01-01',
    };
    mockExecute.mockResolvedValueOnce(makeResult([thread]));
    const result = await getThreadByKey('project:15:version:v1');
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
