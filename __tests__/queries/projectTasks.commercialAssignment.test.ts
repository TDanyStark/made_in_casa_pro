/**
 * Spec: odd/tasks/brand-sourced-project-manager.md — S4
 * Modo comercial de resolveProjectTaskAssignment: el gerente del proyecto se
 * lee de su marca principal (brands.manager_id), no de projects.manager_id.
 */
jest.mock('@/lib/db', () => ({
  db: { execute: jest.fn(), transaction: jest.fn() },
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

import { db } from '@/lib/db';
import { resolveProjectTaskAssignment } from '@/lib/queries/projectTasks';

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
  mockExecute.mockReset();
});

describe('resolveProjectTaskAssignment() — modo comercial', () => {
  it('S4: resuelve el usuario por el correo del gerente de la marca principal', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ created_by: 3, manager_email: 'luis@adium.com' }]))
      .mockResolvedValueOnce(makeResult([{ id: 42 }]));

    const result = await resolveProjectTaskAssignment(10, { assign_to_commercial: 1 });

    expect(result).toBe(42);
    const projectCall = mockExecute.mock.calls[0]?.[0] as { sql: string; args: unknown[] };
    expect(projectCall.sql).toContain('LEFT JOIN brands b ON b.id = p.brand_id');
    expect(projectCall.sql).toContain('LEFT JOIN managers m ON m.id = b.manager_id');
    expect(projectCall.sql).not.toContain('p.manager_id');
    expect(projectCall.args).toEqual([10]);
    const userCall = mockExecute.mock.calls[1]?.[0] as { sql: string; args: unknown[] };
    expect(userCall.args).toEqual(['luis@adium.com']);
  });

  it('conserva el fallback al creador cuando el gerente no tiene usuario', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ created_by: 3, manager_email: 'luis@adium.com' }]))
      .mockResolvedValueOnce(makeResult([]));

    await expect(
      resolveProjectTaskAssignment(10, { assign_to_commercial: 1 })
    ).resolves.toBe(3);
  });
});
