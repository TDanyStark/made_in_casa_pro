/**
 * @jest-environment node
 */

// S15: a pooled connection is released at most once per transaction, and a
// rollback after a commit (e.g. a catch block after post-commit work) is a no-op.
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(mockClient),
    query: jest.fn(),
  })),
}));

import { PostgresAdapter } from "@/lib/db/postgres-adapter";

function sqlCalls() {
  return mockClient.query.mock.calls.map(([sql]) => sql);
}

beforeEach(() => {
  mockClient.query.mockReset();
  mockClient.release.mockReset();
  mockClient.query.mockResolvedValue({ rows: [] });
});

describe("PostgresAdapter.transaction()", () => {
  it("commits and releases the connection once (previous behavior)", async () => {
    const tx = await new PostgresAdapter("postgres://test").transaction("write");
    await tx.execute({ sql: "SELECT 1", args: [] });
    await tx.commit();

    expect(sqlCalls()).toEqual(["BEGIN", "SELECT 1", "COMMIT"]);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("treats a rollback after commit as a no-op: no ROLLBACK and no second release", async () => {
    const tx = await new PostgresAdapter("postgres://test").transaction("write");
    await tx.commit();
    await tx.rollback();

    expect(sqlCalls()).toEqual(["BEGIN", "COMMIT"]);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("releases only once when rollback is called twice", async () => {
    const tx = await new PostgresAdapter("postgres://test").transaction("write");
    await tx.rollback();
    await tx.rollback();

    expect(sqlCalls()).toEqual(["BEGIN", "ROLLBACK"]);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("releases the connection once even when COMMIT fails, and a later rollback does not release again", async () => {
    const tx = await new PostgresAdapter("postgres://test").transaction("write");
    mockClient.query.mockRejectedValueOnce(new Error("commit failed"));

    await expect(tx.commit()).rejects.toThrow("commit failed");
    await tx.rollback();

    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("releases the connection once even when ROLLBACK fails", async () => {
    const tx = await new PostgresAdapter("postgres://test").transaction("write");
    mockClient.query.mockRejectedValueOnce(new Error("rollback failed"));

    await expect(tx.rollback()).rejects.toThrow("rollback failed");
    await tx.rollback();

    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});
