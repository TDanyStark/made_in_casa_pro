// Spec: odd/tasks/project-additional-brands.md — S2, S3, S6, S8
const mockTransaction = {
  execute: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
};

jest.mock("@/lib/db", () => ({
  db: {
    execute: jest.fn(),
    transaction: jest.fn(() => Promise.resolve(mockTransaction)),
  },
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { db } from "@/lib/db";
import {
  createProject,
  getProjectById,
  getProjectsWithPagination,
  updateProject,
} from "@/lib/queries/projects";
import { getMyTasksWithPagination } from "@/lib/queries/projectTasks";

type Query = { sql: string; args?: unknown[] };
const mockExecute = db.execute as jest.Mock;

const rows = (r: Record<string, unknown>[]) => ({ rows: r });

beforeEach(() => {
  jest.clearAllMocks();
  mockExecute.mockReset();
  mockTransaction.execute.mockReset().mockResolvedValue(rows([]));
  mockTransaction.commit.mockReset().mockResolvedValue(undefined);
  mockTransaction.rollback.mockReset().mockResolvedValue(undefined);
});

const txSql = () => mockTransaction.execute.mock.calls.map(([q]) => (q as Query).sql);

describe("reads", () => {
  it("getProjectById returns the additional brands from project_brands", async () => {
    mockExecute.mockResolvedValueOnce(rows([{ id: 1, additional_brands: [{ id: 5, name: "B" }] }]));

    const project = await getProjectById(1);

    const sql = (mockExecute.mock.calls[0][0] as Query).sql;
    expect(sql).toContain("FROM project_brands pb");
    expect(sql).toContain("AS additional_brands");
    expect(project?.additional_brands).toEqual([{ id: 5, name: "B" }]);
  });

  it("brand filter on projects matches principal or additional brand", async () => {
    mockExecute.mockResolvedValue(rows([{ count: 0 }]));

    await getProjectsWithPagination({ brandId: 5 });

    const count = mockExecute.mock.calls[0][0] as Query;
    expect(count.sql).toContain("$1 = ANY(ARRAY[p.brand_id] || ARRAY(SELECT pb.brand_id FROM project_brands pb WHERE pb.project_id = p.id))");
    expect(count.args).toEqual([5]);
  });

  it("brand filter on my-tasks matches principal or additional brand", async () => {
    mockExecute.mockResolvedValue(rows([{ count: 0 }]));

    await getMyTasksWithPagination({ userId: 8, brandId: 5, page: 1, limit: 10 });

    const count = mockExecute.mock.calls[0][0] as Query;
    expect(count.sql).toContain("= ANY(ARRAY[p.brand_id] || ARRAY(SELECT pb.brand_id FROM project_brands pb WHERE pb.project_id = p.id))");
    expect(count.args).toContain(5);
  });
});

describe("createProject", () => {
  function primeCreate() {
    mockExecute
      .mockResolvedValueOnce(rows([{ client_id: 7 }])) // principal brand client
      .mockResolvedValueOnce(rows([{ client_id: 7 }])); // manager client
  }

  it("links the additional brands inside the creation transaction", async () => {
    primeCreate();
    mockExecute
      .mockResolvedValueOnce(rows([{ id: 5, client_id: 7 }, { id: 6, client_id: 7 }]))
      .mockResolvedValue(rows([{ id: 15 }]));
    mockTransaction.execute.mockResolvedValueOnce(rows([{ id: 15 }]));

    await createProject({ title: "P", brand_id: 2, manager_id: 3, additional_brand_ids: [5, 6, 5] });

    const calls = mockTransaction.execute.mock.calls.map(([q]) => q as Query);
    expect(calls).toHaveLength(3);
    expect(calls[2].sql).toContain("INSERT INTO project_brands");
    expect(calls[2].args).toEqual([15, [5, 6]]);
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
  });

  it("does not touch project_brands when no additional brands are sent", async () => {
    primeCreate();
    mockExecute.mockResolvedValue(rows([{ id: 15 }]));
    mockTransaction.execute.mockResolvedValueOnce(rows([{ id: 15 }]));

    await createProject({ title: "P", brand_id: 2, manager_id: 3, additional_brand_ids: [] });

    expect(txSql().some((s) => s.includes("project_brands"))).toBe(false);
  });

  it("rejects an additional brand of another client before inserting", async () => {
    primeCreate();
    mockExecute.mockResolvedValueOnce(rows([{ id: 5, client_id: 99 }]));

    await expect(
      createProject({ title: "P", brand_id: 2, manager_id: 3, additional_brand_ids: [5] })
    ).rejects.toMatchObject({ code: "BRAND_CLIENT_MISMATCH" });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("rejects an unknown additional brand", async () => {
    primeCreate();
    mockExecute.mockResolvedValueOnce(rows([]));

    await expect(
      createProject({ title: "P", brand_id: 2, manager_id: 3, additional_brand_ids: [404] })
    ).rejects.toMatchObject({ code: "BRAND_NOT_FOUND" });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("rejects the principal brand repeated as additional", async () => {
    primeCreate();

    await expect(
      createProject({ title: "P", brand_id: 2, manager_id: 3, additional_brand_ids: [2] })
    ).rejects.toMatchObject({ code: "ADDITIONAL_BRAND_IS_PRINCIPAL" });
    expect(db.transaction).not.toHaveBeenCalled();
  });
});

describe("updateProject", () => {
  const current = { id: 9, status: "active", brand_id: 2, client_id: 7, manager_id: 3 };

  it("replaces the additional brands in one transaction", async () => {
    mockExecute
      .mockResolvedValueOnce(rows([current]))
      .mockResolvedValueOnce(rows([{ id: 5, client_id: 7 }]))
      .mockResolvedValue(rows([{ ...current, additional_brands: [{ id: 5, name: "B" }] }]));

    const updated = await updateProject(9, { additional_brand_ids: [5] });

    const calls = mockTransaction.execute.mock.calls.map(([q]) => q as Query);
    expect(calls.map((c) => c.sql).join("\n")).toContain("DELETE FROM project_brands WHERE project_id = $1");
    expect(calls.find((c) => c.sql.includes("INSERT INTO project_brands"))?.args).toEqual([9, [5]]);
    expect(calls.some((c) => c.sql.includes("UPDATE projects SET updated_at"))).toBe(true);
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
    expect(updated?.additional_brands).toEqual([{ id: 5, name: "B" }]);
  });

  it("an empty list removes every additional brand", async () => {
    mockExecute.mockResolvedValueOnce(rows([current])).mockResolvedValue(rows([current]));

    await updateProject(9, { additional_brand_ids: [] });

    const sql = txSql().join("\n");
    expect(sql).toContain("DELETE FROM project_brands WHERE project_id = $1");
    expect(sql).not.toContain("INSERT INTO project_brands");
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
  });

  it("rejects a brand of another client and leaves links unchanged", async () => {
    mockExecute
      .mockResolvedValueOnce(rows([current]))
      .mockResolvedValueOnce(rows([{ id: 5, client_id: 99 }]));

    await expect(updateProject(9, { additional_brand_ids: [5] })).rejects.toMatchObject({
      code: "BRAND_CLIENT_MISMATCH",
    });
    expect(db.transaction).not.toHaveBeenCalled();
    const writes = mockExecute.mock.calls.filter(([q]) =>
      /INSERT INTO project_brands|DELETE FROM project_brands|UPDATE projects/.test((q as Query).sql)
    );
    expect(writes).toHaveLength(0);
  });

  it("without additional_brand_ids does not touch project_brands", async () => {
    mockExecute.mockResolvedValue(rows([current]));

    await updateProject(9, { title: "Nuevo" });

    const all = [...mockExecute.mock.calls, ...mockTransaction.execute.mock.calls].map(([q]) => (q as Query).sql);
    expect(all.some((s) => s.includes("project_brands") && !s.includes("AS additional_brands"))).toBe(false);
  });
});
