/**
 * Every task must belong to a version (project_adjustments). These tests pin
 * that every INSERT INTO project_tasks path resolves a non-null adjustment_id
 * that belongs to the task's project, defaulting to the base version (v1).
 */

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
import {
  createProjectTask,
  createRejectionLoopTasks,
  instantiateTasksFromTemplates,
} from "@/lib/queries/projectTasks";
import { resolveTaskAdjustmentId } from "@/lib/queries/adjustments";
import { TaskVersionError } from "@/lib/definitions";

const mockExecute = db.execute as jest.MockedFunction<typeof db.execute>;

const MISSING_VERSION = "El proyecto no tiene una versión. No se puede crear la tarea sin versión.";
const FOREIGN_VERSION = "La versión indicada no pertenece al proyecto.";

type Query = string | { sql: string; args?: unknown[] };
const sqlOf = (q: Query) => (typeof q === "string" ? q : q.sql);
const argsOf = (q: Query) => (typeof q === "string" ? [] : q.args ?? []);

/** Versions table for project 1: base v1 = id 5, v2 = id 9. Project 2 owns id 50. */
const VERSIONS = [
  { id: 5, project_id: 1, version_number: 1 },
  { id: 9, project_id: 1, version_number: 2 },
  { id: 50, project_id: 2, version_number: 1 },
];

function versionsLookup(q: Query, versions = VERSIONS) {
  const sql = sqlOf(q);
  const args = argsOf(q);
  if (/WHERE id = \$1 AND project_id = \$2/.test(sql)) {
    const [id, projectId] = args as number[];
    return versions.filter((v) => v.id === id && v.project_id === projectId).map((v) => ({ id: v.id }));
  }
  const [projectId] = args as number[];
  return versions
    .filter((v) => v.project_id === projectId)
    .sort((a, b) => (/version_number DESC/.test(sql) ? b.version_number - a.version_number : a.version_number - b.version_number))
    .slice(0, 1)
    .map((v) => ({ id: v.id }));
}

function result(rows: Record<string, unknown>[]) {
  return { rows } as never;
}

function insertCalls(mock: jest.Mock) {
  return mock.mock.calls.filter(([q]) => sqlOf(q as Query).includes("INSERT INTO project_tasks"));
}

function allInsertCalls() {
  return [...insertCalls(mockExecute as unknown as jest.Mock), ...insertCalls(mockTransaction.execute)];
}

/** Router for db.execute: version lookups, INSERT, and task re-reads. */
function routeDb(versions = VERSIONS) {
  mockExecute.mockImplementation(async (q: Query) => {
    const sql = sqlOf(q);
    if (sql.includes("FROM project_adjustments")) return result(versionsLookup(q, versions));
    if (sql.includes("INSERT INTO project_tasks")) return result([{ id: 77 }]);
    if (sql.includes("FROM product_task_templates")) {
      return result([
        {
          id: 300,
          title: "Plantilla",
          description: null,
          area_id: null,
          assigned_user_id: null,
          order_index: 0,
          task_type: "execution",
          requires_quote: 0,
          assign_to_commercial: 0,
        },
      ]);
    }
    if (sql.includes("WHERE pt.id = $1")) return result([{ id: argsOf(q)[0], project_id: 1 }]);
    return result([]);
  });
  mockTransaction.execute.mockImplementation(async (q: Query) => {
    const sql = sqlOf(q);
    if (sql.includes("FROM project_adjustments")) return result(versionsLookup(q, versions));
    if (sql.includes("INSERT INTO project_tasks")) return result([{ id: 88 }]);
    return result([]);
  });
}

const ADJ_ARG_INDEX = 13; // adjustment_id is $14 in createProjectTask / instantiate / clone INSERTs

beforeEach(() => {
  jest.clearAllMocks();
  mockExecute.mockReset();
  mockTransaction.execute.mockReset();
  mockTransaction.commit.mockResolvedValue(undefined);
  mockTransaction.rollback.mockResolvedValue(undefined);
});

describe("resolveTaskAdjustmentId()", () => {
  it("returns the base version (lowest version_number) when no adjustment id is given", async () => {
    routeDb();
    await expect(resolveTaskAdjustmentId(1)).resolves.toBe(5);
    await expect(resolveTaskAdjustmentId(1, null)).resolves.toBe(5);
  });

  it("returns the latest version when the 'latest' fallback is requested", async () => {
    routeDb();
    await expect(resolveTaskAdjustmentId(1, undefined, db, "latest")).resolves.toBe(9);
    await expect(resolveTaskAdjustmentId(1, null, db, "latest")).resolves.toBe(9);
  });

  it("throws the missing-version error with the 'latest' fallback when the project has no version", async () => {
    routeDb([]);
    const err = await resolveTaskAdjustmentId(1, undefined, db, "latest").catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("El proyecto no tiene una versión. No se puede crear la tarea sin versión.");
  });

  it("returns the explicit adjustment id when it belongs to the project", async () => {
    routeDb();
    await expect(resolveTaskAdjustmentId(1, 9)).resolves.toBe(9);
  });

  it("throws a TaskVersionError with the exact message when the project has no version", async () => {
    routeDb([]);
    const err = await resolveTaskAdjustmentId(1).catch((e) => e);
    expect(err).toBeInstanceOf(TaskVersionError);
    expect(err.message).toBe(MISSING_VERSION);
  });

  it("throws a TaskVersionError with the exact message when the explicit version belongs to another project", async () => {
    routeDb();
    const err = await resolveTaskAdjustmentId(1, 50).catch((e) => e);
    expect(err).toBeInstanceOf(TaskVersionError);
    expect(err.message).toBe(FOREIGN_VERSION);
  });
});

describe("createProjectTask() — version is mandatory", () => {
  const base = { project_id: 1, title: "Nueva", order_index: 0 };

  it("inserts with the project's base version when adjustment_id is omitted", async () => {
    routeDb();
    await createProjectTask(base);
    const inserts = allInsertCalls();
    expect(inserts).toHaveLength(1);
    expect(argsOf(inserts[0][0] as Query)[ADJ_ARG_INDEX]).toBe(5);
  });

  it("inserts with the base version when adjustment_id is null", async () => {
    routeDb();
    await createProjectTask({ ...base, adjustment_id: null });
    expect(argsOf(allInsertCalls()[0][0] as Query)[ADJ_ARG_INDEX]).toBe(5);
  });

  it("keeps an explicit adjustment_id that belongs to the project", async () => {
    routeDb();
    await createProjectTask({ ...base, adjustment_id: 9 });
    expect(argsOf(allInsertCalls()[0][0] as Query)[ADJ_ARG_INDEX]).toBe(9);
  });

  it("throws the exact message and inserts nothing when the project has no version", async () => {
    routeDb([]);
    await expect(createProjectTask(base)).rejects.toThrow(MISSING_VERSION);
    expect(allInsertCalls()).toHaveLength(0);
  });

  it("throws the exact message and inserts nothing when the explicit version belongs to another project", async () => {
    routeDb();
    await expect(createProjectTask({ ...base, adjustment_id: 50 })).rejects.toThrow(FOREIGN_VERSION);
    expect(allInsertCalls()).toHaveLength(0);
  });
});

describe("instantiateTasksFromTemplates() — version is mandatory", () => {
  it("inserts with the base version when adjustmentId is omitted", async () => {
    routeDb();
    await instantiateTasksFromTemplates(1, 3, null);
    const inserts = allInsertCalls();
    expect(inserts).toHaveLength(1);
    expect(argsOf(inserts[0][0] as Query)[ADJ_ARG_INDEX - 1]).toBe(5);
  });

  it("keeps an explicit adjustmentId that belongs to the project", async () => {
    routeDb();
    await instantiateTasksFromTemplates(1, 3, null, 9);
    expect(argsOf(allInsertCalls()[0][0] as Query)[ADJ_ARG_INDEX - 1]).toBe(9);
  });

  it("throws the exact message and inserts nothing when the project has no version", async () => {
    routeDb([]);
    await expect(instantiateTasksFromTemplates(1, 3, null)).rejects.toThrow(MISSING_VERSION);
    expect(allInsertCalls()).toHaveLength(0);
  });

  it("throws the exact message and inserts nothing when the explicit version belongs to another project", async () => {
    routeDb();
    await expect(instantiateTasksFromTemplates(1, 3, null, 50)).rejects.toThrow(FOREIGN_VERSION);
    expect(allInsertCalls()).toHaveLength(0);
  });
});

describe("createRejectionLoopTasks() — clones keep the version", () => {
  function routeRejection(taskNAdjustmentId: number | null, versions = VERSIONS) {
    routeDb(versions);
    const fallback = mockExecute.getMockImplementation()!;
    mockExecute.mockImplementation(async (q: Query) => {
      const sql = sqlOf(q);
      if (sql.includes("SELECT id, order_index, task_flag, status, adjustment_id FROM project_tasks")) {
        return result([{ id: 10, order_index: 3, task_flag: "new", status: "in_progress", adjustment_id: taskNAdjustmentId }]);
      }
      if (sql.includes("SELECT id, order_index FROM project_tasks")) return result([{ id: 7, order_index: 2 }]);
      if (sql.includes("SELECT * FROM project_tasks")) {
        return result([
          { id: 7, title: "M", task_type: "execution", order_index: 2, assigned_user_id: null },
          { id: 10, title: "N", task_type: "validation", order_index: 3, assigned_user_id: null },
        ]);
      }
      return fallback(q);
    });
  }

  it("inserts every clone with the original task's version", async () => {
    routeRejection(9);
    await createRejectionLoopTasks(1, 10, 7, 5);
    const inserts = allInsertCalls();
    expect(inserts).toHaveLength(2);
    for (const [q] of inserts) {
      expect(argsOf(q as Query)[ADJ_ARG_INDEX - 1]).toBe(9);
    }
  });

  it("falls back to the base version for a legacy task without version", async () => {
    routeRejection(null);
    await createRejectionLoopTasks(1, 10, 7, 5);
    for (const [q] of allInsertCalls()) {
      expect(argsOf(q as Query)[ADJ_ARG_INDEX - 1]).toBe(5);
    }
  });

  it("throws the exact message and inserts nothing when the project has no version", async () => {
    routeRejection(null, []);
    await expect(createRejectionLoopTasks(1, 10, 7, 5)).rejects.toThrow(MISSING_VERSION);
    expect(allInsertCalls()).toHaveLength(0);
  });
});
