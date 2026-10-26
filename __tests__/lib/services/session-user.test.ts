/**
 * @jest-environment node
 */
// S4: loads the current is_active / rol_id of the session user from the DB.
jest.unmock("@/lib/services/session-user");

jest.mock("@/lib/db", () => ({
  db: { execute: jest.fn() },
}));

import { db } from "@/lib/db";
import { getSessionUserState } from "@/lib/services/session-user";
import { UserRole } from "@/lib/definitions";

const mockExecute = db.execute as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe("getSessionUserState()", () => {
  it("reads is_active and rol_id by the session user id", async () => {
    mockExecute.mockResolvedValue({ rows: [{ is_active: true, rol_id: 3 }] });

    const state = await getSessionUserState({ id: 7, rol_id: UserRole.ADMIN });

    expect(state).toEqual({ is_active: true, rol_id: UserRole.COMERCIAL });
    expect(mockExecute).toHaveBeenCalledWith({
      sql: expect.stringContaining("FROM users WHERE id = $1"),
      args: [7],
    });
  });

  it("normalizes a 0 is_active to false", async () => {
    mockExecute.mockResolvedValue({ rows: [{ is_active: 0, rol_id: 1 }] });

    expect(await getSessionUserState({ id: 7, rol_id: UserRole.ADMIN })).toEqual({
      is_active: false,
      rol_id: UserRole.ADMIN,
    });
  });

  it("returns null when the user no longer exists", async () => {
    mockExecute.mockResolvedValue({ rows: [] });

    expect(await getSessionUserState({ id: 99, rol_id: UserRole.ADMIN })).toBeNull();
  });
});
