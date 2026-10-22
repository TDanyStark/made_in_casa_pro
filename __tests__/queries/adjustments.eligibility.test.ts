jest.mock('@/lib/db', () => ({ db: { execute: jest.fn() } }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
import { db } from '@/lib/db';
import { getAdjustmentsByProject } from '@/lib/queries/adjustments';

beforeEach(() => jest.clearAllMocks());

it('returns the real completed task count of each version next to task_count without writing', async () => {
  const rows = [{ id: 1, version_number: 1, status: 'active', task_count: '3', completed_task_count: '3' }];
  jest.mocked(db.execute).mockResolvedValue({ rows } as never);

  await expect(getAdjustmentsByProject(10)).resolves.toEqual(rows);

  expect(db.execute).toHaveBeenCalledTimes(1);
  const [{ sql, args }] = jest.mocked(db.execute).mock.calls[0] as unknown as [{ sql: string; args: unknown[] }];
  expect(args).toEqual([10]);
  expect(sql).toContain('COUNT(pt.id) as task_count');
  expect(sql).toContain("COUNT(pt.id) FILTER (WHERE pt.status = 'completed') as completed_task_count");
  expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
});
