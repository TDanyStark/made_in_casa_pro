jest.mock('@/lib/db', () => ({ db: { execute: jest.fn() } }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
import { db } from '@/lib/db';
import { assertLatestTaskVersion } from '@/lib/queries/adjustments';

beforeEach(() => jest.clearAllMocks());

it('accepts the latest version without modifying stored data', async () => {
  jest.mocked(db.execute).mockResolvedValue({ rows: [{ id: 2 }] });
  await expect(assertLatestTaskVersion(10, 2)).resolves.toBeUndefined();
  expect(db.execute).toHaveBeenCalledTimes(1);
  expect(db.execute).toHaveBeenCalledWith({ sql: expect.stringContaining('ORDER BY version_number DESC, id DESC LIMIT 1'), args: [10] });
});

it('rejects a historical version without modifying stored data', async () => {
  jest.mocked(db.execute).mockResolvedValue({ rows: [{ id: 2 }] });
  await expect(assertLatestTaskVersion(10, 1)).rejects.toThrow('Solo se pueden agregar tareas a la última versión del proyecto.');
  expect(db.execute).toHaveBeenCalledTimes(1);
  expect(db.execute).toHaveBeenCalledWith({ sql: expect.stringContaining('SELECT id'), args: [10] });
});
