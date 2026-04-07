/**
 * Integration tests for POST /api/projects/[id]/tasks/[tid]/start
 *
 * Strategy: mock all dependencies at the module boundary (db, session, auth),
 * then call the POST handler directly with a fake NextRequest.
 *
 * @jest-environment node
 */

// ── Mocks (must be before imports) ─────────────────────────────────────────

jest.mock('@/lib/db', () => ({
  db: {
    execute: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('@/lib/session', () => ({
  decrypt: jest.fn(),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

jest.mock('@/lib/services/api-auth', () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock('@/lib/queries/projectTasks', () => ({
  getProjectTaskById: jest.fn(),
  startTask: jest.fn(),
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/api/projects/[id]/tasks/[tid]/start/route';
import { validateHttpMethod, validateApiRole } from '@/lib/services/api-auth';
import { getProjectTaskById, startTask } from '@/lib/queries/projectTasks';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/session';
import { cookies } from 'next/headers';

// Typed mocks
const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetProjectTaskById = getProjectTaskById as jest.MockedFunction<typeof getProjectTaskById>;
const mockStartTask = startTask as jest.MockedFunction<typeof startTask>;
const mockDbExecute = db.execute as jest.MockedFunction<typeof db.execute>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(projectId = '1', taskId = '10') {
  const url = `http://localhost/api/projects/${projectId}/tasks/${taskId}/start`;
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

function makeParams(projectId = '1', taskId = '10') {
  return { params: Promise.resolve({ id: projectId, tid: taskId }) };
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    project_id: 1,
    template_id: null,
    title: 'Do the Work',
    description: null,
    area_id: 2,
    area_name: 'Design',
    assigned_user_id: 5,
    assigned_user_name: 'Alice',
    assigned_user_rol_id: 4,
    assigned_user_is_internal: 1,
    status: 'not_started',
    task_type: 'execution',
    task_flag: 'new',
    requires_quote: 0,
    assign_to_commercial: 0,
    order_index: 0,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    quote_count: 0,
    pending_quote_count: 0,
    quoter_ids: [],
    ...overrides,
  };
}

async function callPost(req: NextRequest, params: ReturnType<typeof makeParams>): Promise<NextResponse> {
  const result = await POST(req, params);
  if (!result) throw new Error('POST handler returned undefined');
  return result as NextResponse;
}

function setupAuthMocks(userId = 5, userRole = 4) {
  mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
  mockValidateApiRole.mockResolvedValue({
    isAuthorized: true,
    userRole: userRole as never,
    response: undefined,
  } as never);
  mockCookies.mockResolvedValue({
    get: jest.fn().mockReturnValue({ value: 'fake-cookie' }),
  } as never);
  mockDecrypt.mockResolvedValue({ id: userId } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /start — success cases', () => {
  it('returns 200 when assigned user starts their own not_started task', async () => {
    setupAuthMocks(5, 4); // userId=5, role=COLABORADOR
    mockGetProjectTaskById.mockResolvedValue(makeTask({ assigned_user_id: 5 }) as never);
    mockStartTask.mockResolvedValue({ success: true });

    const req = makeRequest();
    const res = await callPost(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toMatch(/iniciada/i);
    expect(mockStartTask).toHaveBeenCalledWith(10, 5);
  });

  it('returns 200 when admin user who is project creator starts a task', async () => {
    setupAuthMocks(1, 1); // userId=1, role=ADMIN
    mockGetProjectTaskById.mockResolvedValue(makeTask({ assigned_user_id: 99 }) as never); // different user assigned
    // db.execute returns project with created_by = 1
    mockDbExecute.mockResolvedValueOnce({
      rows: [{ created_by: 1 }],
      columns: [],
      columnTypes: [],
      rowsAffected: 1,
      toJSON: () => ({}),
    } as never);
    mockStartTask.mockResolvedValue({ success: true });

    const req = makeRequest();
    const res = await callPost(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toMatch(/iniciada/i);
    expect(mockDbExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining('SELECT created_by FROM projects'),
      })
    );
  });
});

describe('POST /start — error cases', () => {
  it('returns 404 when task not found', async () => {
    setupAuthMocks();
    mockGetProjectTaskById.mockResolvedValue(null);

    const req = makeRequest();
    const res = await callPost(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/no encontrada/i);
    expect(mockStartTask).not.toHaveBeenCalled();
  });

  it('returns 400 when task belongs to a different project', async () => {
    setupAuthMocks();
    mockGetProjectTaskById.mockResolvedValue(makeTask({ project_id: 999 }) as never);

    const req = makeRequest('1', '10');
    const res = await callPost(req, makeParams('1', '10'));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/no pertenece/i);
  });

  it('returns 403 when non-assigned collaborator tries to start the task', async () => {
    setupAuthMocks(99, 4); // userId=99, role=COLABORADOR, not assigned
    mockGetProjectTaskById.mockResolvedValue(makeTask({ assigned_user_id: 5 }) as never);

    const req = makeRequest();
    const res = await callPost(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toMatch(/permiso/i);
  });

  it('returns 403 when manager is NOT the project creator', async () => {
    setupAuthMocks(2, 1); // userId=2, role=ADMIN
    mockGetProjectTaskById.mockResolvedValue(makeTask({ assigned_user_id: 5 }) as never);
    // db.execute returns project with created_by = 99 (not userId=2)
    mockDbExecute.mockResolvedValueOnce({
      rows: [{ created_by: 99 }],
      columns: [],
      columnTypes: [],
      rowsAffected: 1,
      toJSON: () => ({}),
    } as never);

    const req = makeRequest();
    const res = await callPost(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toMatch(/permiso/i);
  });

  it('returns 400 when startTask returns error (e.g. wrong status)', async () => {
    setupAuthMocks(5, 4);
    mockGetProjectTaskById.mockResolvedValue(makeTask({ assigned_user_id: 5 }) as never);
    mockStartTask.mockResolvedValue({ success: false, error: 'La tarea debe estar en estado "sin iniciar" para poder tomarla' });

    const req = makeRequest();
    const res = await callPost(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('sin iniciar');
  });

  it('returns 401 when session is missing', async () => {
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: 4 as never,
      response: undefined,
    } as never);
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue(undefined), // no cookie
    } as never);
    mockDecrypt.mockResolvedValue(null);
    mockGetProjectTaskById.mockResolvedValue(makeTask() as never);

    const req = makeRequest();
    const res = await callPost(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(401);
  });
});
