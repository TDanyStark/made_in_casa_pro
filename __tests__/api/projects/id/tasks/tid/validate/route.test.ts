/**
 * Integration tests for POST /api/projects/[id]/tasks/[tid]/validate
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
  validateTask: jest.fn(),
  createRejectionLoopTasks: jest.fn(),
}));

jest.mock('@/lib/queries/projects', () => ({
  recalculateProjectProgress: jest.fn(),
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/api/projects/[id]/tasks/[tid]/validate/route';
import { validateHttpMethod, validateApiRole } from '@/lib/services/api-auth';
import { getProjectTaskById, validateTask } from '@/lib/queries/projectTasks';
import { recalculateProjectProgress } from '@/lib/queries/projects';
import { decrypt } from '@/lib/session';
import { cookies } from 'next/headers';

// Typed mocks
const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetProjectTaskById = getProjectTaskById as jest.MockedFunction<typeof getProjectTaskById>;
const mockValidateTask = validateTask as jest.MockedFunction<typeof validateTask>;
const mockRecalculate = recalculateProjectProgress as jest.MockedFunction<typeof recalculateProjectProgress>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>, projectId = '1', taskId = '10') {
  const url = `http://localhost/api/projects/${projectId}/tasks/${taskId}/validate`;
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeParams(projectId = '1', taskId = '10') {
  return { params: Promise.resolve({ id: projectId, tid: taskId }) };
}

// A full task row (validation, in_progress)
function makeValidationTask(overrides: Record<string, unknown> = {}) {
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

function makeCorrectionTask(id: number, orderIndex: number) {
  return makeValidationTask({ id, order_index: orderIndex, task_flag: 'correction', status: 'not_started' });
}

// Invoke POST and always return a NextResponse (throw if undefined)
async function callPost(req: NextRequest, params: ReturnType<typeof makeParams>): Promise<NextResponse> {
  const result = await POST(req, params);
  if (!result) throw new Error('POST handler returned undefined');
  return result as NextResponse;
}

// ── Setup shared auth mocks ──────────────────────────────────────────────────

function setupAuthMocks(userId = 5) {
  mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
  mockValidateApiRole.mockResolvedValue({
    isAuthorized: true,
    userRole: 1 as never,
    response: undefined,
  } as never);
  mockCookies.mockResolvedValue({
    get: jest.fn().mockReturnValue({ value: 'fake-cookie' }),
  } as never);
  mockDecrypt.mockResolvedValue({ id: userId } as never);
  mockRecalculate.mockResolvedValue(undefined as never);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── 5.6: POST reject creates 2 new tasks ─────────────────────────────────────

describe('POST /validate — reject action', () => {
  it('5.6 — returns 200 and calls validateTask when action=reject and targetTaskId provided', async () => {
    setupAuthMocks();
    mockGetProjectTaskById.mockResolvedValue(makeValidationTask() as never);
    mockValidateTask.mockResolvedValue({
      task: makeValidationTask({ status: 'completed' }) as never,
      targetTask: makeCorrectionTask(101, 4) as never,
      blockedReason: undefined,
    });

    const req = makeRequest({ action: 'reject', targetTaskId: 7, notes: 'Fix this please' });
    const res = await callPost(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockValidateTask).toHaveBeenCalledWith(10, 5, 'reject', 7, 'Fix this please');
    expect(data.task).toBeDefined();
  });

  it('5.6 — validateTask is called with action="reject" and targetTaskId as number', async () => {
    setupAuthMocks();
    mockGetProjectTaskById.mockResolvedValue(makeValidationTask() as never);
    mockValidateTask.mockResolvedValue({
      task: makeValidationTask({ status: 'completed' }) as never,
      targetTask: makeCorrectionTask(101, 4) as never,
    });

    const req = makeRequest({ action: 'reject', targetTaskId: 7 });
    await callPost(req, makeParams());

    expect(mockValidateTask).toHaveBeenCalledWith(
      10,         // taskId
      5,          // userId
      'reject',
      7,          // targetTaskId (number, not string)
      undefined   // notes is optional
    );
  });

  // ── 5.7: returns 400 when targetTaskId missing ─────────────────────────────

  it('5.7 — returns 400 when action=reject but targetTaskId is missing', async () => {
    setupAuthMocks();
    mockGetProjectTaskById.mockResolvedValue(makeValidationTask() as never);

    const req = makeRequest({ action: 'reject', notes: 'Something is wrong' });
    const res = await callPost(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/targetTaskId/i);
    expect(mockValidateTask).not.toHaveBeenCalled();
  });

  // ── 5.9: error from validateTask propagates as 500 ─────────────────────────

  it('5.9 — returns 500 with immutability message when task is already completed', async () => {
    setupAuthMocks();
    // getProjectTaskById returns an in_progress task (route-level checks pass)
    mockGetProjectTaskById.mockResolvedValue(makeValidationTask() as never);
    // validateTask throws the immutability error (e.g. from completeTask guard)
    mockValidateTask.mockRejectedValue(
      new Error('Esta tarea ya está completada y no puede modificarse')
    );

    const req = makeRequest({ action: 'reject', targetTaskId: 7 });
    const res = await callPost(req, makeParams());
    const data = await res.json();

    // The route catches errors from validateTask and returns 500 with the message
    expect(res.status).toBe(500);
    expect(data.error).toContain('completada');
  });
});

// ── 5.8: approve path works unchanged ────────────────────────────────────────

describe('POST /validate — approve action', () => {
  it('allows financiero to override validation the same as directivo', async () => {
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: 5 as never,
      response: undefined,
    } as never);
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: 'fake-cookie' }),
    } as never);
    mockDecrypt.mockResolvedValue({ id: 99 } as never);
    mockRecalculate.mockResolvedValue(undefined as never);
    mockGetProjectTaskById.mockResolvedValue(makeValidationTask({ assigned_user_id: 5 }) as never);
    mockValidateTask.mockResolvedValue({
      task: makeValidationTask({ status: 'completed' }) as never,
      targetTask: null,
    });

    const res = await callPost(makeRequest({ action: 'approve' }), makeParams());

    expect(res.status).toBe(200);
    expect(mockValidateTask).toHaveBeenCalledWith(10, 99, 'approve', undefined, undefined);
  });

  it('5.8 — returns 200 and calls validateTask with action=approve', async () => {
    setupAuthMocks();
    mockGetProjectTaskById.mockResolvedValue(makeValidationTask() as never);
    mockValidateTask.mockResolvedValue({
      task: makeValidationTask({ status: 'completed' }) as never,
      targetTask: makeValidationTask({ id: 11, order_index: 4, status: 'not_started' }) as never,
      blockedReason: undefined,
    });

    const req = makeRequest({ action: 'approve', notes: 'Looks good!' });
    const res = await callPost(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockValidateTask).toHaveBeenCalledWith(10, 5, 'approve', undefined, 'Looks good!');
    expect(data.task).toBeDefined();
    // targetTask should be the next task (from approve path)
    expect(data.targetTask).toBeDefined();
  });

  it('5.8 — validateTask is called (not createRejectionLoopTasks) on approve', async () => {
    setupAuthMocks();
    mockGetProjectTaskById.mockResolvedValue(makeValidationTask() as never);
    mockValidateTask.mockResolvedValue({
      task: makeValidationTask({ status: 'completed' }) as never,
      targetTask: null,
    });

    const req = makeRequest({ action: 'approve' });
    await callPost(req, makeParams());

    // validateTask is called with approve
    expect(mockValidateTask).toHaveBeenCalledWith(10, 5, 'approve', undefined, undefined);
  });

  it('5.8 — recalculateProjectProgress is called after approve', async () => {
    setupAuthMocks();
    mockGetProjectTaskById.mockResolvedValue(makeValidationTask() as never);
    mockValidateTask.mockResolvedValue({
      task: makeValidationTask({ status: 'completed' }) as never,
      targetTask: null,
    });

    const req = makeRequest({ action: 'approve' });
    await callPost(req, makeParams());

    expect(mockRecalculate).toHaveBeenCalledWith(1);  // projectId=1
  });
});

// ── Additional: task not found / task type checks ─────────────────────────────

describe('POST /validate — task checks', () => {
  it('returns 404 when task is not found', async () => {
    setupAuthMocks();
    mockGetProjectTaskById.mockResolvedValue(null);

    const req = makeRequest({ action: 'approve' });
    const res = await callPost(req, makeParams());

    expect(res.status).toBe(404);
  });

  it('returns 400 when task is not a validation type', async () => {
    setupAuthMocks();
    mockGetProjectTaskById.mockResolvedValue(makeValidationTask({ task_type: 'execution' }) as never);

    const req = makeRequest({ action: 'approve' });
    const res = await callPost(req, makeParams());

    expect(res.status).toBe(400);
  });
});
