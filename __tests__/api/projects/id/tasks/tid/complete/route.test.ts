/**
 * Integration tests for POST /api/projects/[id]/tasks/[tid]/complete
 *
 * Focus: role-based override. A COMERCIAL (rol 3) who is NOT the assignee
 * must be able to complete any task (override), while a COLABORADOR (rol 4)
 * who is not assigned must be rejected with 403.
 *
 * Strategy: mock all dependencies at the module boundary, then call the POST
 * handler directly with a fake NextRequest.
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
  completeTask: jest.fn(),
}));

jest.mock('@/lib/queries/projects', () => ({
  recalculateProjectProgress: jest.fn(),
}));

jest.mock('@/lib/services/notificationEngine', () => ({
  dispatchNotification: jest.fn(),
  recalculateProgressAndNotify: jest.fn(),
  NOTIFICATION_EVENTS: { TASK_COMPLETED: 'task_completed', TASK_READY: 'task.ready', TASK_QUEUE_STALLED: 'task.queue_stalled' },
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/api/projects/[id]/tasks/[tid]/complete/route';
import { validateHttpMethod, validateApiRole } from '@/lib/services/api-auth';
import { getProjectTaskById, completeTask } from '@/lib/queries/projectTasks';
import { dispatchNotification, recalculateProgressAndNotify } from '@/lib/services/notificationEngine';
import { decrypt } from '@/lib/session';
import { cookies } from 'next/headers';
import { UserRole } from '@/lib/definitions';

// Typed mocks
const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetProjectTaskById = getProjectTaskById as jest.MockedFunction<typeof getProjectTaskById>;
const mockCompleteTask = completeTask as jest.MockedFunction<typeof completeTask>;
const mockRecalculate = recalculateProgressAndNotify as jest.MockedFunction<typeof recalculateProgressAndNotify>;
const mockDispatch = dispatchNotification as jest.MockedFunction<typeof dispatchNotification>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown> = { progress_minutes: 30 }, projectId = '1', taskId = '10') {
  const url = `http://localhost/api/projects/${projectId}/tasks/${taskId}/complete`;
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeParams(projectId = '1', taskId = '10') {
  return { params: Promise.resolve({ id: projectId, tid: taskId }) };
}

// An execution task assigned to user 5, in progress
function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    project_id: 1,
    title: 'Do the work',
    assigned_user_id: 5,
    status: 'in_progress',
    task_type: 'execution',
    ...overrides,
  };
}

async function callPost(req: NextRequest, params: ReturnType<typeof makeParams>): Promise<NextResponse> {
  const result = await POST(req, params);
  if (!result) throw new Error('POST handler returned undefined');
  return result as NextResponse;
}

// Configure auth mocks for a given role + current userId (the caller).
function setupAuthMocks(userRole: number, userId: number) {
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
  mockRecalculate.mockResolvedValue(undefined as never);
  mockDispatch.mockResolvedValue(undefined as never);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /complete — role override', () => {
  it('allows a COMERCIAL who is NOT the assignee to complete the task', async () => {
    // Caller is comercial (rol 3) with id 99; task is assigned to user 5.
    setupAuthMocks(UserRole.COMERCIAL, 99);
    mockGetProjectTaskById.mockResolvedValue(makeTask() as never);
    mockCompleteTask.mockResolvedValue({
      task: makeTask({ status: 'completed' }) as never,
      nextTask: null,
      blockedReason: undefined,
    } as never);

    const res = await callPost(makeRequest(), makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockCompleteTask).toHaveBeenCalledWith(10, 99, undefined, {
      progress_minutes: 30,
      delivery_url: undefined,
      completion_cost: undefined,
    });
    expect(data.task).toBeDefined();
    // Progress recalculated after the DB work, with the caller as the ready-to-close actor
    expect(mockRecalculate).toHaveBeenCalledTimes(1);
    expect(mockRecalculate).toHaveBeenCalledWith(1, 99);
  });

  it('allows the assigned COLABORADOR to complete their own task', async () => {
    // Caller is the assignee (id 5), even though colaborador has no override.
    setupAuthMocks(UserRole.COLABORADOR, 5);
    mockGetProjectTaskById.mockResolvedValue(makeTask() as never);
    mockCompleteTask.mockResolvedValue({
      task: makeTask({ status: 'completed' }) as never,
      nextTask: null,
    } as never);

    const res = await callPost(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    expect(mockCompleteTask).toHaveBeenCalled();
  });

  it('rejects a COLABORADOR who is NOT the assignee with 403', async () => {
    // Caller is colaborador (rol 4) id 99; task assigned to user 5 — no override.
    setupAuthMocks(UserRole.COLABORADOR, 99);
    mockGetProjectTaskById.mockResolvedValue(makeTask() as never);

    const res = await callPost(makeRequest(), makeParams());
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toMatch(/asignado/i);
    expect(mockCompleteTask).not.toHaveBeenCalled();
  });

  it('returns 404 when the task does not exist', async () => {
    setupAuthMocks(UserRole.COMERCIAL, 99);
    mockGetProjectTaskById.mockResolvedValue(null);

    const res = await callPost(makeRequest(), makeParams());

    expect(res.status).toBe(404);
    expect(mockCompleteTask).not.toHaveBeenCalled();
  });
});

describe('POST /complete — task.ready for the activated next task', () => {
  function readyCalls() {
    return mockDispatch.mock.calls.filter(([input]) => input.eventType === 'task.ready');
  }

  it('dispatches task.ready (after task.completed) when the next task was activated to not_started with an assignee', async () => {
    setupAuthMocks(UserRole.COLABORADOR, 5);
    mockGetProjectTaskById.mockResolvedValue(makeTask() as never);
    mockCompleteTask.mockResolvedValue({
      task: makeTask({ status: 'completed' }) as never,
      nextTask: makeTask({ id: 11, status: 'not_started', assigned_user_id: 8 }) as never,
      nextActivated: true,
    } as never);

    const res = await callPost(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    expect(mockDispatch.mock.calls.map(([i]) => i.eventType)).toEqual(['task_completed', 'task.ready']);
    expect(mockDispatch).toHaveBeenLastCalledWith({
      eventType: 'task.ready',
      actorUserId: 5,
      projectId: 1,
      taskId: 11,
    });
  });

  it('does not dispatch task.ready when the next task was set to blocked', async () => {
    setupAuthMocks(UserRole.COLABORADOR, 5);
    mockGetProjectTaskById.mockResolvedValue(makeTask() as never);
    mockCompleteTask.mockResolvedValue({
      task: makeTask({ status: 'completed' }) as never,
      nextTask: makeTask({ id: 11, status: 'blocked', assigned_user_id: null }) as never,
      blockedReason: 'La siguiente tarea no tiene colaborador asignado.',
    } as never);

    const res = await callPost(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    expect(readyCalls()).toHaveLength(0);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch task.ready when the next task is not_started without assignee or there is no next task', async () => {
    setupAuthMocks(UserRole.COLABORADOR, 5);
    mockGetProjectTaskById.mockResolvedValue(makeTask() as never);
    mockCompleteTask.mockResolvedValueOnce({
      task: makeTask({ status: 'completed' }) as never,
      nextTask: makeTask({ id: 11, status: 'not_started', assigned_user_id: null }) as never,
    } as never);
    await callPost(makeRequest(), makeParams());

    mockCompleteTask.mockResolvedValueOnce({
      task: makeTask({ status: 'completed' }) as never,
      nextTask: null,
    } as never);
    await callPost(makeRequest(), makeParams());

    expect(readyCalls()).toHaveLength(0);
  });

  it('S2: does not dispatch task.ready again when the next task was already active', async () => {
    setupAuthMocks(UserRole.COLABORADOR, 5);
    mockGetProjectTaskById.mockResolvedValue(makeTask() as never);
    mockCompleteTask.mockResolvedValue({
      task: makeTask({ status: 'completed' }) as never,
      nextTask: makeTask({ id: 11, status: 'not_started', assigned_user_id: 8 }) as never,
      nextActivated: false,
      nextCompleted: false,
    } as never);

    const res = await callPost(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    expect(readyCalls()).toHaveLength(0);
  });
});

describe('POST /complete — S3 queue stalled notice to the commercial', () => {
  function stalledCalls() {
    return mockDispatch.mock.calls.filter(([input]) => input.eventType === 'task.queue_stalled');
  }

  it('dispatches task.queue_stalled for the completed task when the next task was already completed', async () => {
    setupAuthMocks(UserRole.COLABORADOR, 5);
    mockGetProjectTaskById.mockResolvedValue(makeTask() as never);
    mockCompleteTask.mockResolvedValue({
      task: makeTask({ status: 'completed' }) as never,
      nextTask: makeTask({ id: 11, status: 'completed' }) as never,
      nextActivated: false,
      nextCompleted: true,
    } as never);

    const res = await callPost(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    expect(mockDispatch.mock.calls.map(([i]) => i.eventType)).toEqual(['task_completed', 'task.queue_stalled']);
    expect(mockDispatch).toHaveBeenLastCalledWith({
      eventType: 'task.queue_stalled',
      actorUserId: 5,
      projectId: 1,
      taskId: 10,
    });
  });

  it('does not dispatch task.queue_stalled when the next task was activated, already active or missing', async () => {
    setupAuthMocks(UserRole.COLABORADOR, 5);
    mockGetProjectTaskById.mockResolvedValue(makeTask() as never);
    mockCompleteTask.mockResolvedValueOnce({
      task: makeTask({ status: 'completed' }) as never,
      nextTask: makeTask({ id: 11, status: 'not_started', assigned_user_id: 8 }) as never,
      nextActivated: true,
      nextCompleted: false,
    } as never);
    await callPost(makeRequest(), makeParams());

    mockCompleteTask.mockResolvedValueOnce({
      task: makeTask({ status: 'completed' }) as never,
      nextTask: makeTask({ id: 11, status: 'in_progress', assigned_user_id: 8 }) as never,
      nextActivated: false,
      nextCompleted: false,
    } as never);
    await callPost(makeRequest(), makeParams());

    mockCompleteTask.mockResolvedValueOnce({
      task: makeTask({ status: 'completed' }) as never,
      nextTask: null,
      nextActivated: false,
      nextCompleted: false,
    } as never);
    await callPost(makeRequest(), makeParams());

    expect(stalledCalls()).toHaveLength(0);
  });
});

describe('POST /complete — mandatory time tracking', () => {
  it('returns 400 when progress_minutes is missing', async () => {
    setupAuthMocks(UserRole.COLABORADOR, 5);
    mockGetProjectTaskById.mockResolvedValue(makeTask() as never);

    const res = await callPost(makeRequest({}), makeParams());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Debes registrar el tiempo invertido en la tarea');
    expect(mockCompleteTask).not.toHaveBeenCalled();
    expect(mockRecalculate).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('returns 400 when progress_minutes is 0', async () => {
    setupAuthMocks(UserRole.COLABORADOR, 5);
    mockGetProjectTaskById.mockResolvedValue(makeTask() as never);

    const res = await callPost(makeRequest({ progress_minutes: 0 }), makeParams());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Debes registrar al menos 1 minuto de tiempo invertido');
    expect(mockCompleteTask).not.toHaveBeenCalled();
    expect(mockRecalculate).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

// S8: an external assignee (colaborador whose is_internal is 0 or NULL) must declare the cost.
describe('POST /complete — external cost required (S8)', () => {
  const COST_ERROR = 'Debes ingresar el costo del trabajo antes de completar.';
  const completed = () => ({
    task: makeTask({ status: 'completed' }) as never,
    nextTask: null,
  } as never);

  it.each([
    ['is_internal NULL, no cost', null, { progress_minutes: 30 }],
    ['is_internal NULL, cost null', null, { progress_minutes: 30, completion_cost: null }],
    ['is_internal 0, no cost', 0, { progress_minutes: 30 }],
  ])('rejects an external colaborador (%s) with 400 and writes nothing', async (_label, isInternal, body) => {
    setupAuthMocks(UserRole.COLABORADOR, 5);
    mockGetProjectTaskById.mockResolvedValue(
      makeTask({ assigned_user_rol_id: UserRole.COLABORADOR, assigned_user_is_internal: isInternal, requires_quote: 0 }) as never
    );

    const res = await callPost(makeRequest(body), makeParams());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: COST_ERROR });
    expect(mockCompleteTask).not.toHaveBeenCalled();
    expect(mockRecalculate).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('completes an external colaborador task when the cost is declared', async () => {
    setupAuthMocks(UserRole.COLABORADOR, 5);
    mockGetProjectTaskById.mockResolvedValue(
      makeTask({ assigned_user_rol_id: UserRole.COLABORADOR, assigned_user_is_internal: null, requires_quote: 0 }) as never
    );
    mockCompleteTask.mockResolvedValue(completed());

    const res = await callPost(makeRequest({ progress_minutes: 30, completion_cost: 500000 }), makeParams());

    expect(res.status).toBe(200);
    expect(mockCompleteTask).toHaveBeenCalledWith(10, 5, undefined, {
      progress_minutes: 30,
      delivery_url: undefined,
      completion_cost: 500000,
    });
  });

  // Externals may declare 0 for free work (reviews, adjustments); only a missing cost is rejected.
  it('completes an external colaborador task declared as free (cost 0)', async () => {
    setupAuthMocks(UserRole.COLABORADOR, 5);
    mockGetProjectTaskById.mockResolvedValue(
      makeTask({ assigned_user_rol_id: UserRole.COLABORADOR, assigned_user_is_internal: 0, requires_quote: 0 }) as never
    );
    mockCompleteTask.mockResolvedValue(completed());

    const res = await callPost(makeRequest({ progress_minutes: 30, completion_cost: 0 }), makeParams());

    expect(res.status).toBe(200);
    expect(mockCompleteTask).toHaveBeenCalledWith(10, 5, undefined, {
      progress_minutes: 30,
      delivery_url: undefined,
      completion_cost: 0,
    });
  });

  it('does not require the cost when the task price comes from a quote', async () => {
    setupAuthMocks(UserRole.COLABORADOR, 5);
    mockGetProjectTaskById.mockResolvedValue(
      makeTask({ assigned_user_rol_id: UserRole.COLABORADOR, assigned_user_is_internal: 0, requires_quote: 1 }) as never
    );
    mockCompleteTask.mockResolvedValue(completed());

    const res = await callPost(makeRequest({ progress_minutes: 30 }), makeParams());

    expect(res.status).toBe(200);
    expect(mockCompleteTask).toHaveBeenCalledTimes(1);
  });

  it('still completes an internal colaborador task without cost', async () => {
    setupAuthMocks(UserRole.COLABORADOR, 5);
    mockGetProjectTaskById.mockResolvedValue(
      makeTask({ assigned_user_rol_id: UserRole.COLABORADOR, assigned_user_is_internal: 1, requires_quote: 0 }) as never
    );
    mockCompleteTask.mockResolvedValue(completed());

    const res = await callPost(makeRequest({ progress_minutes: 30 }), makeParams());

    expect(res.status).toBe(200);
    expect(mockCompleteTask).toHaveBeenCalledWith(10, 5, undefined, {
      progress_minutes: 30,
      delivery_url: undefined,
      completion_cost: undefined,
    });
  });

  it('keeps not requiring the cost for a non-colaborador assignee with is_internal NULL', async () => {
    setupAuthMocks(UserRole.COMERCIAL, 5);
    mockGetProjectTaskById.mockResolvedValue(
      makeTask({ assigned_user_rol_id: UserRole.COMERCIAL, assigned_user_is_internal: null, requires_quote: 0 }) as never
    );
    mockCompleteTask.mockResolvedValue(completed());

    const res = await callPost(makeRequest({ progress_minutes: 30 }), makeParams());

    expect(res.status).toBe(200);
    expect(mockCompleteTask).toHaveBeenCalledTimes(1);
  });
});
