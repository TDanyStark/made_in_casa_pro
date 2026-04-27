/**
 * @jest-environment node
 */

jest.mock('@/lib/services/api-auth', () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock('@/lib/queries/projects', () => ({
  getProjectDetail: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { PATCH } from '@/api/projects/[id]/route';
import { validateApiRole, validateHttpMethod } from '@/lib/services/api-auth';
import { updateProject } from '@/lib/queries/projects';

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockUpdateProject = updateProject as jest.MockedFunction<typeof updateProject>;

async function callPatch(req: NextRequest, id = '10') {
  const response = await PATCH(req, { params: Promise.resolve({ id }) });
  if (!response) throw new Error('PATCH handler returned undefined');
  return response;
}

describe('PATCH /api/projects/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: 1 as never,
      response: undefined,
    } as never);
  });

  it('accepts partial metadata updates and normalizes values', async () => {
    mockUpdateProject.mockResolvedValue({ id: 10 } as never);

    const req = new NextRequest('http://localhost/api/projects/10', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billing_closed_at: '2026-04-20T12:00',
        oc: '  OC-900  ',
      }),
    });

    const res = await callPatch(req);

    expect(res.status).toBe(200);
    expect(mockUpdateProject).toHaveBeenCalledWith(10, {
      billing_closed_at: '2026-04-20T17:00:00.000Z',
      oc: 'OC-900',
    });
  });

  it('accepts null metadata updates', async () => {
    mockUpdateProject.mockResolvedValue({ id: 10 } as never);

    const req = new NextRequest('http://localhost/api/projects/10', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ideal_delivery_at: null,
        billing_closed_at: null,
        oc: null,
      }),
    });

    const res = await callPatch(req);

    expect(res.status).toBe(200);
    expect(mockUpdateProject).toHaveBeenCalledWith(10, {
      ideal_delivery_at: null,
      billing_closed_at: null,
      oc: null,
    });
  });

  it('accepts in-adjustments status updates', async () => {
    mockUpdateProject.mockResolvedValue({ id: 10 } as never);

    const req = new NextRequest('http://localhost/api/projects/10', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_adjustments' }),
    });

    const res = await callPatch(req);

    expect(res.status).toBe(200);
    expect(mockUpdateProject).toHaveBeenCalledWith(10, { status: 'in_adjustments' });
  });

  it('rejects invalid project metadata datetime values', async () => {
    const req = new NextRequest('http://localhost/api/projects/10', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billing_closed_at: '20-04-2026 12:00',
      }),
    });

    const res = await callPatch(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/inválidos/i);
    expect(mockUpdateProject).not.toHaveBeenCalled();
  });
});
