/**
 * GET /api/projects/[id]/tasks/[tid]/context
 * S1, S4, S7 of odd/tasks/task-detail-sheet.md.
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
  getTaskWorkContext: jest.fn(),
}));
jest.mock('@/lib/queries/projects', () => ({
  userCanAccessProject: jest.fn(),
}));

import { NextRequest, NextResponse } from 'next/server';
import { GET } from '@/api/projects/[id]/tasks/[tid]/context/route';
import { validateHttpMethod, validateApiRole } from '@/lib/services/api-auth';
import { getProjectTaskById, getTaskWorkContext } from '@/lib/queries/projectTasks';
import { userCanAccessProject } from '@/lib/queries/projects';
import { decrypt } from '@/lib/session';
import { cookies } from 'next/headers';

const mockGetTask = getProjectTaskById as jest.Mock;
const mockContext = getTaskWorkContext as jest.Mock;
const mockCanAccess = userCanAccessProject as jest.Mock;

const req = () => new NextRequest('http://localhost/api/projects/3/tasks/10/context', { method: 'GET' });
const params = (id = '3', tid = '10') => ({ params: Promise.resolve({ id, tid }) });

async function call(p = params()): Promise<Response> {
  const res = await GET(req(), p);
  if (!res) throw new Error('handler returned undefined');
  return res;
}

function auth(userId = 5, role = 4) {
  (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true });
  (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: role });
  (cookies as jest.Mock).mockResolvedValue({ get: jest.fn().mockReturnValue({ value: 'c' }) });
  (decrypt as jest.Mock).mockResolvedValue({ id: userId });
}

const context = {
  task_id: 10,
  project_id: 3,
  drive_folder_url: 'https://drive.google.com/v2',
  project_notes: '<p>Tono cálido</p>',
  version_notes: null,
  version_number: 2,
  previous_tasks: [],
};

beforeEach(() => jest.clearAllMocks());

describe('GET /api/projects/[id]/tasks/[tid]/context', () => {
  it('returns the work context to a collaborator with access to the project', async () => {
    auth(5, 4);
    mockGetTask.mockResolvedValue({ id: 10, project_id: 3, assigned_user_id: 5 });
    mockCanAccess.mockResolvedValue(true);
    mockContext.mockResolvedValue(context);

    const res = await call();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(context);
    expect(mockCanAccess).toHaveBeenCalledWith(3, 5, 4);
    expect(mockContext).toHaveBeenCalledWith(10);
  });

  it('rejects a collaborator without access to the task project and loads no context', async () => {
    auth(8, 4);
    mockGetTask.mockResolvedValue({ id: 10, project_id: 3, assigned_user_id: 5 });
    mockCanAccess.mockResolvedValue(false);

    const res = await call();

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'No tienes acceso a este proyecto' });
    expect(mockContext).not.toHaveBeenCalled();
  });

  it('checks access against the task own project, not the URL project id', async () => {
    auth(5, 4);
    mockGetTask.mockResolvedValue({ id: 10, project_id: 3, assigned_user_id: 5 });
    mockCanAccess.mockResolvedValue(true);
    mockContext.mockResolvedValue(context);

    await call(params('0', '10'));

    expect(mockCanAccess).toHaveBeenCalledWith(3, 5, 4);
  });

  it('lets an operations role read the context without a project access check', async () => {
    auth(1, 1);
    mockGetTask.mockResolvedValue({ id: 10, project_id: 3, assigned_user_id: 5 });
    mockContext.mockResolvedValue(context);

    const res = await call();

    expect(res.status).toBe(200);
    expect(mockCanAccess).not.toHaveBeenCalled();
  });

  it('returns 404 when the task does not exist', async () => {
    auth(5, 4);
    mockGetTask.mockResolvedValue(null);

    const res = await call();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Tarea no encontrada' });
    expect(mockContext).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-numeric task id', async () => {
    auth(5, 4);

    const res = await call(params('3', 'abc'));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'ID de tarea inválido' });
    expect(mockGetTask).not.toHaveBeenCalled();
  });

  it('returns the auth response when the role is not authorized', async () => {
    (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true });
    (validateApiRole as jest.Mock).mockResolvedValue({
      isAuthorized: false,
      response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    });

    const res = await call();

    expect(res.status).toBe(401);
    expect(mockGetTask).not.toHaveBeenCalled();
  });
});
