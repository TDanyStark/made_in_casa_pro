/**
 * @jest-environment node
 */
// S5: userCanAccessProject. Quote invitations grant collaborator access only when the caller opts in.
jest.mock("@/lib/db", () => ({
  db: { execute: jest.fn(), transaction: jest.fn() },
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { db } from "@/lib/db";
import { userCanAccessProject } from "@/lib/queries/projects";
import { UserRole } from "@/lib/definitions";

const mockExecute = db.execute as jest.Mock;
const sqlOf = (i: number) => (mockExecute.mock.calls[i][0] as { sql: string }).sql;
const argsOf = (i: number) => (mockExecute.mock.calls[i][0] as { args: unknown[] }).args;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("userCanAccessProject()", () => {
  it("without the option only checks assigned tasks for a COLABORADOR (previous behavior)", async () => {
    mockExecute.mockResolvedValue({ rows: [] });

    await expect(userCanAccessProject(12, 21, UserRole.COLABORADOR)).resolves.toBe(false);

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(sqlOf(0)).toBe(
      "SELECT 1 FROM project_tasks WHERE project_id = $1 AND assigned_user_id = $2 LIMIT 1"
    );
    expect(argsOf(0)).toEqual([12, 21]);
    expect(sqlOf(0)).not.toMatch(/task_quote_invitations/);
  });

  it("without the option allows a COLABORADOR with an assigned task (previous behavior)", async () => {
    mockExecute.mockResolvedValue({ rows: [{ "?column?": 1 }] });

    await expect(userCanAccessProject(12, 21, UserRole.COLABORADOR)).resolves.toBe(true);
  });

  it("with includeQuoteInvitations allows a COLABORADOR invited to quote a task of the project", async () => {
    mockExecute.mockResolvedValue({ rows: [{ "?column?": 1 }] });

    await expect(
      userCanAccessProject(12, 21, UserRole.COLABORADOR, { includeQuoteInvitations: true })
    ).resolves.toBe(true);

    expect(mockExecute).toHaveBeenCalledTimes(1);
    const sql = sqlOf(0);
    expect(sql).toMatch(/assigned_user_id = \$2/);
    expect(sql).toMatch(
      /EXISTS \(\s*SELECT 1 FROM task_quote_invitations tqi\s+JOIN project_tasks pt ON pt\.id = tqi\.task_id\s+WHERE pt\.project_id = \$1 AND tqi\.user_id = \$2\s*\)/
    );
    expect(argsOf(0)).toEqual([12, 21]);
  });

  it("with includeQuoteInvitations denies a COLABORADOR with neither task nor invitation", async () => {
    mockExecute.mockResolvedValue({ rows: [] });

    await expect(
      userCanAccessProject(12, 21, UserRole.COLABORADOR, { includeQuoteInvitations: true })
    ).resolves.toBe(false);
  });

  it("the option does not widen COMERCIAL access", async () => {
    mockExecute.mockResolvedValue({ rows: [] });

    await expect(
      userCanAccessProject(12, 21, UserRole.COMERCIAL, { includeQuoteInvitations: true })
    ).resolves.toBe(false);

    expect(sqlOf(0)).toBe("SELECT 1 FROM projects WHERE id = $1 AND created_by = $2 LIMIT 1");
  });
});
