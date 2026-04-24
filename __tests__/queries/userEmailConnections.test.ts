jest.mock('@/lib/db', () => ({
  db: {
    execute: jest.fn(),
  },
}));

import { db } from '@/lib/db';
import {
  getUserEmailConnection,
  getUserConnectedEmailStatus,
  createUserEmailConnection,
  updateUserEmailConnectionTokens,
  markEmailConnectionInvalid,
  disconnectUserEmailConnection,
} from '@/lib/queries/userEmailConnections';

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

describe('getUserEmailConnection()', () => {
  it('returns the connection for a user with gmail provider', async () => {
    const connection = {
      id: 1, user_id: 5, provider: 'gmail', email: 'user@gmail.com',
      access_token: 'token', refresh_token: 'refresh', expires_at: '2026-05-01T00:00:00Z',
      scopes: 'gmail.send', status: 'connected', last_error: null,
      created_at: '2026-01-01', updated_at: '2026-01-01',
    };
    mockExecute.mockResolvedValueOnce(makeResult([connection]));
    const result = await getUserEmailConnection(5, 'gmail');
    expect(result?.email).toBe('user@gmail.com');
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('user_email_connections'),
      args: [5, 'gmail'],
    }));
  });

  it('returns null when no connection exists', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    const result = await getUserEmailConnection(999);
    expect(result).toBeNull();
  });
});

describe('getUserConnectedEmailStatus()', () => {
  it('returns true when user has valid connected gmail', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ '1': 1 }]));
    const result = await getUserConnectedEmailStatus(5);
    expect(result).toBe(true);
  });

  it('returns false when user has no gmail connection', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    const result = await getUserConnectedEmailStatus(5);
    expect(result).toBe(false);
  });
});

describe('createUserEmailConnection()', () => {
  it('inserts connection with all required fields', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 1, user_id: 5, provider: 'gmail', email: 'user@gmail.com',
      access_token: 'token', refresh_token: 'refresh', expires_at: '2026-05-01',
      scopes: 'gmail.send', status: 'connected', last_error: null,
      created_at: '2026-01-01', updated_at: '2026-01-01',
    }]));
    await createUserEmailConnection({
      user_id: 5,
      email: 'user@gmail.com',
      access_token: 'token',
      refresh_token: 'refresh',
      expires_at: new Date('2026-05-01'),
      scopes: 'gmail.send',
    });
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('INSERT INTO user_email_connections'),
      args: expect.arrayContaining([5, 'user@gmail.com', 'token', 'refresh']),
    }));
  });

  it('uses upsert ON CONFLICT to update existing connection', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 1, user_id: 5, provider: 'gmail', email: 'user@gmail.com',
      access_token: 'new_token', refresh_token: 'new_refresh', expires_at: '2026-06-01',
      scopes: 'gmail.send', status: 'connected', last_error: null,
      created_at: '2026-01-01', updated_at: '2026-01-02',
    }]));
    await createUserEmailConnection({
      user_id: 5,
      email: 'user@gmail.com',
      access_token: 'new_token',
      refresh_token: 'new_refresh',
      expires_at: new Date('2026-06-01'),
    });
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('ON CONFLICT (user_id, provider)'),
    }));
  });
});

describe('updateUserEmailConnectionTokens()', () => {
  it('updates tokens and resets status to connected', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await updateUserEmailConnectionTokens(5, {
      access_token: 'new_token',
      refresh_token: 'new_refresh',
      expires_at: new Date('2026-06-01'),
    });
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('access_token = $2'),
      args: [5, 'new_token', 'new_refresh', expect.any(Date)],
    }));
  });
});

describe('markEmailConnectionInvalid()', () => {
  it('sets status to invalid and stores error message', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await markEmailConnectionInvalid(5, 'Token expired');
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining("status = 'invalid'"),
      args: [5, 'Token expired'],
    }));
  });
});

describe('disconnectUserEmailConnection()', () => {
  it('clears tokens and sets status to disconnected', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));
    await disconnectUserEmailConnection(5);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining("status = 'disconnected'"),
      args: [5],
    }));
  });
});