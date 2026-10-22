/**
 * POST /api/projects/[id]/tasks/[tid]/pause and /resume
 * S3, S5, S7 of odd/tasks/single-in-progress-task.md.
 *
 * @jest-environment node
 */

jest.mock('@/lib/session', () => ({ decrypt: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/services/api-auth', () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));
jest.mock('@/lib/queries/projectTasks', () => ({
  getProjectTaskById: jest.fn(),
  pauseTask: jest.fn(),
  resumeTask: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { POST as pauseHandler } from '@/api/projects/[id]/tasks/[tid]/pause/route';
import { POST as resumeHandler } from '@/api/projects/[id]/tasks/[tid]/resume/route';
import { validateHttpMethod, validateApiRole } from '@/lib/services/api-auth';
import { getProjectTaskById, pauseTask, resumeTask } from '@/lib/queries/projectTasks';
import { decrypt } from '@/lib/session';
import { cookies } from 'next/headers';

const mockGetTask = getProjectTaskById as jest.Mock;
const mockPause = pauseTask as jest.Mock;
const mockResume = resumeTask as jest.Mock;

function req(action: 'pause' | 'resume') {
  return new NextRequest(`http://localhost/api/projects/1/tasks/10/${action}`, { method: 'POST', body: '{}' });
}
async function pausePOST(...args: Parameters<typeof pauseHandler>): Promise<Response> {
  const res = await pauseHandler(...args);
  if (!res) throw new Error('pause handler returned undefined');
  return res;
}
async function resumePOST(...args: Parameters<typeof resumeHandler>): Promise<Response> {
  const res = await resumeHandler(...args);
  if (!res) throw new Error('resume handler returned undefined');
  return res;
}
const params = (id = '1', tid = '10') => ({ params: Promise.resolve({ id, tid }) });

function auth(userId = 5, role = 4) {
  (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true });
  (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: role });
  (cookies as jest.Mock).mockResolvedValue({ get: jest.fn().mockReturnValue({ value: 'c' }) });
  (decrypt as jest.Mock).mockResolvedValue({ id: userId });
}

const task = (overrides: Record<string, unknown> = {}) => ({ id: 10, project_id: 1, assigned_user_id: 5, ...overrides });

beforeEach(() => jest.clearAllMocks());

describe('POST /pause', () => {
  it('lets the assignee pause their task', async () => {
    auth(5, 4);
    mockGetTask.mockResolvedValue(task());
    mockPause.mockResolvedValue({ success: true });

    const res = await pausePOST(req('pause'), params());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Tarea pausada correctamente' });
    expect(mockPause).toHaveBeenCalledWith(10, 5);
  });

  it('lets a leadership role pause a task assigned to someone else', async () => {
    auth(1, 1);
    mockGetTask.mockResolvedValue(task({ assigned_user_id: 99 }));
    mockPause.mockResolvedValue({ success: true });

    const res = await pausePOST(req('pause'), params());

    expect(res.status).toBe(200);
    expect(mockPause).toHaveBeenCalledWith(10, 1);
  });

  it('rejects a collaborator who is not the assignee', async () => {
    auth(99, 4);
    mockGetTask.mockResolvedValue(task());

    const res = await pausePOST(req('pause'), params());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'No tienes permiso para pausar esta tarea' });
    expect(mockPause).not.toHaveBeenCalled();
  });

  it('returns 400 with the query error when the task is not in progress', async () => {
    auth(5, 4);
    mockGetTask.mockResolvedValue(task());
    mockPause.mockResolvedValue({ success: false, error: 'Solo se pueden pausar tareas en progreso' });

    const res = await pausePOST(req('pause'), params());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Solo se pueden pausar tareas en progreso' });
  });

  it('returns 404 for a missing task and 400 for a task of another project', async () => {
    auth(5, 4);
    mockGetTask.mockResolvedValueOnce(null);
    const missing = await pausePOST(req('pause'), params());
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'Tarea no encontrada' });

    mockGetTask.mockResolvedValueOnce(task({ project_id: 2 }));
    const other = await pausePOST(req('pause'), params());
    expect(other.status).toBe(400);
    expect(await other.json()).toEqual({ error: 'Tarea no pertenece al proyecto' });
    expect(mockPause).not.toHaveBeenCalled();
  });

  it('returns 401 without session', async () => {
    auth();
    (decrypt as jest.Mock).mockResolvedValue(null);

    const res = await pausePOST(req('pause'), params());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'No autenticado' });
  });
});

describe('POST /resume', () => {
  it('resumes and reports the tasks that were paused automatically', async () => {
    auth(5, 4);
    mockGetTask.mockResolvedValue(task());
    mockResume.mockResolvedValue({ success: true, pausedTaskIds: [20] });

    const res = await resumePOST(req('resume'), params());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Tarea reanudada correctamente', pausedTaskIds: [20] });
    expect(mockResume).toHaveBeenCalledWith(10, 5);
  });

  it('rejects a collaborator who is not the assignee', async () => {
    auth(99, 4);
    mockGetTask.mockResolvedValue(task());

    const res = await resumePOST(req('resume'), params());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'No tienes permiso para reanudar esta tarea' });
    expect(mockResume).not.toHaveBeenCalled();
  });

  it('returns 400 when the task is not paused', async () => {
    auth(5, 4);
    mockGetTask.mockResolvedValue(task());
    mockResume.mockResolvedValue({ success: false, error: 'Solo se pueden reanudar tareas pausadas' });

    const res = await resumePOST(req('resume'), params());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Solo se pueden reanudar tareas pausadas' });
  });
});
