jest.mock('@/lib/db', () => ({
  db: {
    execute: jest.fn(),
  },
}));

import { db } from '@/lib/db';
import {
  createNotificationDelivery,
  markDeliverySent,
  markDeliveryFailed,
  markDeliverySkipped,
  getDeliveriesByEvent,
  getDeliveriesByUser,
  getDeliveriesByProject,
  getDeliveryCountByEventAndRecipient,
  resetDeliveryForRetry,
  MAX_RETRY_COUNT,
} from '@/lib/queries/notificationDeliveries';

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

describe('createNotificationDelivery()', () => {
  it('inserts delivery with pending status by default', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 1, event_id: 10, recipient_user_id: 5, recipient_email: 'to@example.com',
      sender_user_id: 3, provider: 'gmail', status: 'pending', error: null,
      gmail_thread_id: null, message_id: null, sent_at: null, created_at: '2026-01-01',
    }]));
    const result = await createNotificationDelivery({
      event_id: 10,
      recipient_user_id: 5,
      recipient_email: 'to@example.com',
      sender_user_id: 3,
    });
    expect(result.status).toBe('pending');
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('INSERT INTO notification_deliveries'),
    }));
  });

  it('defaults to gmail provider when not specified', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 1, event_id: 10, recipient_user_id: null, recipient_email: 'to@example.com',
      sender_user_id: null, provider: 'gmail', status: 'pending', error: null,
      gmail_thread_id: null, message_id: null, sent_at: null, created_at: '2026-01-01',
    }]));
    const result = await createNotificationDelivery({
      event_id: 10,
      recipient_email: 'to@example.com',
    });
    expect(result.provider).toBe('gmail');
  });
});

describe('markDeliverySent()', () => {
  it('updates status to sent and sets sent_at', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await markDeliverySent(1, { gmail_thread_id: 'thread-123', message_id: 'msg-456' });
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining("status = 'sent'"),
      args: [1, 'thread-123', 'msg-456'],
    }));
  });

  it('does not overwrite existing thread/message ids if not provided', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await markDeliverySent(1, {});
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      args: [1, null, null],
    }));
  });
});

describe('markDeliveryFailed()', () => {
  it('sets status to failed with error message', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await markDeliveryFailed(1, 'SMTP connection refused');
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining("status = 'failed'"),
      args: [1, 'SMTP connection refused'],
    }));
  });
});

describe('markDeliverySkipped()', () => {
  it('sets status to skipped with reason', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await markDeliverySkipped(1, 'Recipient opted out');
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining("status = 'skipped'"),
      args: [1, 'Recipient opted out'],
    }));
  });
});

describe('getDeliveriesByEvent()', () => {
  it('returns deliveries ordered by created_at ASC', async () => {
    const deliveries = [
      { id: 1, event_id: 10, recipient_user_id: 5, recipient_email: 'to@example.com', sender_user_id: 3, provider: 'gmail', status: 'sent', error: null, gmail_thread_id: null, message_id: null, sent_at: '2026-01-01', created_at: '2026-01-01' },
    ];
    mockExecute.mockResolvedValueOnce(makeResult(deliveries));
    const result = await getDeliveriesByEvent(10);
    expect(result).toHaveLength(1);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('ORDER BY created_at ASC'),
      args: [10],
    }));
  });

  it('returns empty array on error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    const result = await getDeliveriesByEvent(10);
    expect(result).toEqual([]);
  });
});

describe('getDeliveriesByUser()', () => {
  it('finds deliveries where user is recipient or sender', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await getDeliveriesByUser(5);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('WHERE nd.recipient_user_id = $1 OR nd.sender_user_id = $1'),
      args: [5, 50],
    }));
  });

  it('uses custom limit when provided', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await getDeliveriesByUser(5, 20);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      args: [5, 20],
    }));
  });

  it('returns empty array on error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    const result = await getDeliveriesByUser(5);
    expect(result).toEqual([]);
  });
});

describe('getDeliveriesByProject()', () => {
  it('queries deliveries by project_id ordered DESC', async () => {
    const rows = [
      {
        id: 1, event_id: 10, recipient_user_id: 5, recipient_email: 'to@example.com',
        sender_user_id: 3, provider: 'gmail', status: 'sent', error: null,
        gmail_thread_id: null, message_id: null, sent_at: '2026-01-01', created_at: '2026-01-01',
        retry_count: 0, last_attempt_at: null, event_type: 'task.completed',
        project_id: 15, project_title: 'Project X', task_id: null, task_title: null,
        adjustment_id: null, actor_user_id: 3, actor_name: 'Alice',
      },
    ];
    mockExecute.mockResolvedValueOnce(makeResult(rows));

    const result = await getDeliveriesByProject(15);
    expect(result).toHaveLength(1);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('WHERE ne.project_id = $1'),
      args: [15, 50],
    }));
  });

  it('uses custom limit when provided', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await getDeliveriesByProject(15, 20);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      args: [15, 20],
    }));
  });

  it('returns empty array on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    const result = await getDeliveriesByProject(15);
    expect(result).toEqual([]);
  });
});

describe('getDeliveryCountByEventAndRecipient() — idempotency', () => {
  it('returns count of non-skipped deliveries for the event+recipient pair', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ cnt: 1 }]));
    const count = await getDeliveryCountByEventAndRecipient(10, 'to@example.com');
    expect(count).toBe(1);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining("WHERE event_id = $1 AND recipient_email = $2"),
      args: [10, 'to@example.com'],
    }));
  });

  it('returns 0 when no deliveries exist', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ cnt: 0 }]));
    const count = await getDeliveryCountByEventAndRecipient(99, 'nobody@test.com');
    expect(count).toBe(0);
  });

  it('returns 0 on DB error (safe fallback)', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    const count = await getDeliveryCountByEventAndRecipient(10, 'to@example.com');
    expect(count).toBe(0);
  });

  it('excludes skipped deliveries from count', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ cnt: 0 }]));
    await getDeliveryCountByEventAndRecipient(10, 'to@example.com');
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining("status != 'skipped'"),
    }));
  });
});

describe('resetDeliveryForRetry()', () => {
  it('resets status to pending and clears error for a failed delivery', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await resetDeliveryForRetry(42);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining("SET status = 'pending'"),
      args: [42],
    }));
  });

  it('only resets if status is failed', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await resetDeliveryForRetry(42);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining("AND status = 'failed'"),
    }));
  });

  it('throws on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB error'));
    await expect(resetDeliveryForRetry(42)).rejects.toThrow('DB error');
  });
});

describe('MAX_RETRY_COUNT constant', () => {
  it('is defined and equals 3', () => {
    expect(MAX_RETRY_COUNT).toBe(3);
  });
});