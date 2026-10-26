/**
 * @jest-environment node
 */
// S35 (bug review round 2): a missing or empty SESSION_SECRET fails with a clear
// error at the point of use instead of signing/verifying with an empty key.
// Importing the module without the variable must not crash (build, tests).
jest.mock('server-only', () => ({}));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));

import { decrypt, encrypt } from '@/lib/session';
import { UserRole } from '@/lib/definitions';

const ORIGINAL_SECRET = process.env.SESSION_SECRET;
const MISSING = 'SESSION_SECRET no está configurado';
const payload = { id: 3, email: 'a@test.com', rol_id: UserRole.ADMIN };

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = ORIGINAL_SECRET;
});

describe('session key (S35)', () => {
  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['blank', '   '],
  ])('encrypt rejects with a clear error when SESSION_SECRET is %s', async (_label, value) => {
    if (value === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = value;

    await expect(encrypt(payload)).rejects.toThrow(MISSING);
  });

  it('decrypt rejects with the same clear error instead of verifying with an empty key', async () => {
    process.env.SESSION_SECRET = 'a-real-secret-for-signing';
    const token = await encrypt(payload);
    delete process.env.SESSION_SECRET;

    await expect(decrypt(token)).rejects.toThrow(MISSING);
  });

  it('signs and verifies a session when SESSION_SECRET is set (previous behavior)', async () => {
    process.env.SESSION_SECRET = 'a-real-secret-for-signing';

    const token = await encrypt(payload);

    expect(await decrypt(token)).toMatchObject(payload);
    expect(await decrypt('not-a-jwt')).toBeNull();
  });
});
