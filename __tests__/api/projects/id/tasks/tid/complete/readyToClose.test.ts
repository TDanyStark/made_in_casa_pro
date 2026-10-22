/**
 * Integration: POST /api/projects/[id]/tasks/[tid]/complete → project.ready_to_close
 *
 * Unlike route.test.ts, the notification engine is REAL here: only its data
 * boundaries (queries, email service) are mocked, so the test proves that a
 * completion that takes the project to 100% emails the commercial exactly once.
 *
 * @jest-environment node
 */

jest.mock('@/lib/db', () => ({
  db: { execute: jest.fn(), transaction: jest.fn() },
}));

jest.mock('@/lib/session', () => ({ decrypt: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));

jest.mock('@/lib/services/api-auth', () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock('@/lib/queries/projectTasks', () => ({
  getProjectTaskById: jest.fn(),
  completeTask: jest.fn(),
  getTaskDriveFolderUrl: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/queries/projects', () => ({
  getProjectById: jest.fn(),
  recalculateProjectProgressWithTransition: jest.fn(),
}));

jest.mock('@/lib/queries/notificationEvents', () => ({
  createNotificationEvent: jest.fn(),
}));

jest.mock('@/lib/queries/notificationRecipients', () => ({
  getProjectStakeholders: jest.fn().mockResolvedValue([]),
  getTaskAssignee: jest.fn().mockResolvedValue(null),
  getTaskProjectCreator: jest.fn().mockResolvedValue(null),
  getQuoteInvitee: jest.fn(),
  getQuoteReceivedRecipient: jest.fn(),
  getAcceptedQuoteCollaborator: jest.fn(),
  getUserNotificationRecipient: jest.fn(),
  getProjectCommercial: jest.fn(),
  getActorName: jest.fn().mockResolvedValue('Ana García'),
}));

jest.mock('@/lib/queries/projectEmailThreads', () => ({
  resolveProjectVersionThreadKey: jest.fn().mockResolvedValue('project:1:version:v1'),
}));

jest.mock('@/lib/services/email/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ deliveryId: 1, provider: 'gmail' }),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/api/projects/[id]/tasks/[tid]/complete/route';
import { validateApiRole, validateHttpMethod } from '@/lib/services/api-auth';
import { completeTask, getProjectTaskById } from '@/lib/queries/projectTasks';
import { getProjectById, recalculateProjectProgressWithTransition } from '@/lib/queries/projects';
import { createNotificationEvent } from '@/lib/queries/notificationEvents';
import { getProjectCommercial } from '@/lib/queries/notificationRecipients';
import { sendEmail } from '@/lib/services/email/emailService';
import { decrypt } from '@/lib/session';
import { cookies } from 'next/headers';
import { UserRole } from '@/lib/definitions';

const mockRecalc = recalculateProjectProgressWithTransition as jest.Mock;
const mockCreateEvent = createNotificationEvent as jest.Mock;
const mockSendEmail = sendEmail as jest.Mock;

const commercial = { userId: 3, email: 'comercial@test.com', name: 'Daniel Amado' };

function callComplete() {
  return POST(
    new NextRequest('http://localhost/api/projects/1/tasks/10/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress_minutes: 30 }),
    }),
    { params: Promise.resolve({ id: '1', tid: '10' }) }
  );
}

function readyToCloseEvents() {
  return mockCreateEvent.mock.calls.filter(([e]) => e.event_type === 'project.ready_to_close');
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.madeincasa.com';
  (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
  (validateApiRole as jest.Mock).mockResolvedValue({
    isAuthorized: true,
    userRole: UserRole.COLABORADOR,
    response: undefined,
  });
  (cookies as jest.Mock).mockResolvedValue({ get: jest.fn().mockReturnValue({ value: 'cookie' }) });
  (decrypt as jest.Mock).mockResolvedValue({ id: 5 });
  (getProjectTaskById as jest.Mock).mockResolvedValue({
    id: 10, project_id: 1, title: 'Última tarea', assigned_user_id: 5, status: 'in_progress', task_type: 'execution',
  });
  (completeTask as jest.Mock).mockResolvedValue({
    task: { id: 10, status: 'completed' },
    nextTask: null,
  });
  (getProjectById as jest.Mock).mockResolvedValue({
    id: 1, title: 'Campaña Q2', client_name: 'Acme Corp', brand_name: 'Acme',
  });
  (getProjectCommercial as jest.Mock).mockResolvedValue(commercial);
  mockCreateEvent.mockResolvedValue({ id: 77 });
});

describe('POST /complete — project.ready_to_close', () => {
  it('emails the commercial once when completing the last task takes the project to 100%', async () => {
    mockRecalc.mockResolvedValue({ progress: 100, reachedCompletion: true });

    const res = await callComplete();

    expect(res!.status).toBe(200);
    expect(mockRecalc).toHaveBeenCalledTimes(1);
    expect(mockRecalc).toHaveBeenCalledWith(1);
    expect(readyToCloseEvents()).toHaveLength(1);
    expect(readyToCloseEvents()[0][0]).toEqual(
      expect.objectContaining({ project_id: 1, task_id: null, actor_user_id: 5 })
    );
    const readyEmails = mockSendEmail.mock.calls.filter(([c]) => c.eventId === 77 && c.recipientUserId === 3);
    expect(readyEmails.length).toBeGreaterThanOrEqual(1);
    const readyEmail = mockSendEmail.mock.calls
      .map(([c]) => c)
      .find((c) => c.message.subject === '[Campaña Q2] Tu proyecto está al 100%, listo para cerrar');
    expect(readyEmail).toBeDefined();
    expect(readyEmail.message.to).toEqual({ email: 'comercial@test.com', name: 'Daniel Amado' });
    expect(readyEmail.message.html).toContain('https://app.madeincasa.com/projects/1');
  });

  it('does not send it when the completion does not reach 100%', async () => {
    mockRecalc.mockResolvedValue({ progress: 75, reachedCompletion: false });

    const res = await callComplete();

    expect(res!.status).toBe(200);
    expect(readyToCloseEvents()).toHaveLength(0);
    expect(
      mockSendEmail.mock.calls.filter(([c]) => String(c.message.subject).includes('listo para cerrar'))
    ).toHaveLength(0);
  });
});
