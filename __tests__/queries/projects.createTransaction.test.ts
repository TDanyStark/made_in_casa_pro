// S18: creating a project inserts the project and its V1 version in one transaction.
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

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createProject } from "@/lib/queries/projects";

type Query = { sql: string; args?: unknown[] };
const mockExecute = db.execute as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockExecute.mockReset();
  mockTransaction.execute.mockReset();
  mockTransaction.commit.mockReset().mockResolvedValue(undefined);
  mockTransaction.rollback.mockReset().mockResolvedValue(undefined);
  mockExecute
    .mockResolvedValueOnce({ rows: [{ client_id: 7, manager_id: 3 }] }) // brand client + manager
    .mockResolvedValueOnce({ rows: [{ client_id: 7 }] }) // manager client
    .mockResolvedValue({ rows: [{ id: 15, title: "Proyecto" }] }); // getProjectById
});

it("inserts the project and its V1 version inside the same transaction", async () => {
  mockTransaction.execute
    .mockResolvedValueOnce({ rows: [{ id: 15 }] })
    .mockResolvedValueOnce({ rows: [] });

  const project = await createProject({ title: "Proyecto", brand_id: 2, manager_id: 3, drive_folder_id: "f1", drive_folder_url: "u1" });

  const calls = mockTransaction.execute.mock.calls.map(([q]) => q as Query);
  expect(calls).toHaveLength(2);
  expect(calls[0].sql).toContain("INSERT INTO projects");
  expect(calls[1].sql).toContain("INSERT INTO project_adjustments");
  expect(calls[1].args).toEqual([15, "f1", "u1"]);
  expect(mockExecute.mock.calls.some(([q]) => /INSERT/.test((q as Query).sql))).toBe(false);
  expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
  expect(revalidatePath).toHaveBeenCalledWith("/projects");
  expect(project).toEqual({ id: 15, title: "Proyecto" });
});

it("rolls back the project when the V1 version cannot be created", async () => {
  mockTransaction.execute
    .mockResolvedValueOnce({ rows: [{ id: 15 }] })
    .mockRejectedValueOnce(new Error("insert failed"));

  await expect(createProject({ title: "Proyecto", brand_id: 2, manager_id: 3 })).rejects.toThrow("insert failed");

  expect(mockTransaction.commit).not.toHaveBeenCalled();
  expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
  expect(revalidatePath).not.toHaveBeenCalled();
});
