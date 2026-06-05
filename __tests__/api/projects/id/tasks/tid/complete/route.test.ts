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
  NOTIFICATION_EVENTS: { TASK_COMPLETED: 'task_completed' },
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/api/projects/[id]/tasks/[tid]/complete/route';
import { validateHttpMethod, validateApiRole } from '@/lib/services/api-auth';
import { getProjectTaskById, completeTask } from '@/lib/queries/projectTasks';
import { recalculateProjectProgress } from '@/lib/queries/projects';
import { dispatchNotification } from '@/lib/services/notificationEngine';
import { decrypt } from '@/lib/session';
import { cookies } from 'next/headers';
import { UserRole } from '@/lib/definitions';

// Typed mocks
const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetProjectTaskById = getProjectTaskById as jest.MockedFunction<typeof getProjectTaskById>;
const mockCompleteTask = completeTask as jest.MockedFunction<typeof completeTask>;
const mockRecalculate = recalculateProjectProgress as jest.MockedFunction<typeof recalculateProjectProgress>;
const mockDispatch = dispatchNotification as jest.MockedFunction<typeof dispatchNotification>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown> = { progress_minutes: 0 }, projectId = '1', taskId = '10') {
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
    expect(mockCompleteTask).toHaveBeenCalledWith(10, 99, undefined, expect.any(Object));
    expect(data.task).toBeDefined();
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
