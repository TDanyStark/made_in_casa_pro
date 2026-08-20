/** @jest-environment node */

jest.mock("@/lib/queries/projects", () => ({
  clearProjectDriveAccessFailure: jest.fn(),
  getProjectById: jest.fn(),
  getProjectExpectedDriveRecipients: jest.fn(),
  upsertProjectDriveAccessFailure: jest.fn(),
}));
jest.mock("@/lib/services/googleDrive", () => ({
  syncDriveFolderAccessDetailed: jest.fn(),
}));

import {
  clearProjectDriveAccessFailure,
  getProjectById,
  getProjectExpectedDriveRecipients,
  upsertProjectDriveAccessFailure,
} from "@/lib/queries/projects";
import { syncDriveFolderAccessDetailed } from "@/lib/services/googleDrive";
import {
  buildExpectedDriveRecipientStatuses,
  syncProjectDriveAccess,
} from "@/lib/services/projectDriveAccess";

describe("syncProjectDriveAccess", () => {
  beforeEach(() => jest.clearAllMocks());

  it("resolves the folder and current stakeholder set server-side", async () => {
    (getProjectById as jest.Mock).mockResolvedValue({ id: 8, drive_folder_id: "folder-8" });
    (getProjectExpectedDriveRecipients as jest.Mock).mockResolvedValue([
      { email: "a@test.com", name: "A", sources: ["leadership"] },
      { email: "b@test.com", name: "B", sources: ["manager"] },
    ]);
    (syncDriveFolderAccessDetailed as jest.Mock).mockResolvedValue({
      warning: null,
      attempts: [
        { email: "a@test.com", failureCode: null },
        { email: "b@test.com", failureCode: "NO_GOOGLE_ACCOUNT" },
      ],
    });
    await expect(syncProjectDriveAccess(8)).resolves.toBeNull();
    expect(syncDriveFolderAccessDetailed).toHaveBeenCalledWith("folder-8", ["a@test.com", "b@test.com"]);
    expect(clearProjectDriveAccessFailure).toHaveBeenCalledWith(8, "a@test.com");
    expect(upsertProjectDriveAccessFailure).toHaveBeenCalledWith(8, "b@test.com", "NO_GOOGLE_ACCOUNT");
  });

  it("keeps the business mutation successful when stakeholder resolution fails", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    (getProjectById as jest.Mock).mockRejectedValue(new Error("database unavailable"));
    await expect(syncProjectDriveAccess(8)).resolves.toEqual({
      code: "DRIVE_ACCESS_SYNC_FAILED",
      message: "No se pudieron sincronizar todos los accesos de Google Drive.",
    });
  });
});

describe("buildExpectedDriveRecipientStatuses", () => {
  const recipient = { email: "person@abbott.com", name: "Person", sources: ["manager" as const] };
  const permission = (overrides: Record<string, unknown>) => ({
    id: "p", type: "user", role: "writer", emailAddress: null, displayName: null,
    domain: null, inherited: false, isConnectedAccount: false, canDelete: true, ...overrides,
  });

  it.each([
    ["direct", permission({ emailAddress: "PERSON@ABBOTT.COM", inherited: true })],
    ["domain", permission({ type: "domain", domain: "abbott.com" })],
    ["anyone", permission({ type: "anyone" })],
  ])("recognizes effective %s writer access", (_label, acl) => {
    const [result] = buildExpectedDriveRecipientStatuses([recipient], [acl], []);
    expect(result.status).toBe("has_access");
  });

  it("distinguishes a weaker effective role without marking it missing", () => {
    const [result] = buildExpectedDriveRecipientStatuses(
      [recipient], [permission({ type: "domain", domain: "abbott.com", role: "reader" })], []
    );
    expect(result).toMatchObject({ status: "insufficient_role", actualRole: "reader" });
  });

  it("uses the strongest matching grant regardless of permission order", () => {
    const [result] = buildExpectedDriveRecipientStatuses(
      [recipient],
      [
        permission({ type: "anyone", role: "reader" }),
        permission({ type: "domain", domain: "abbott.com", role: "writer" }),
        permission({ emailAddress: "PERSON@ABBOTT.COM", role: "commenter" }),
      ],
      []
    );
    expect(result).toMatchObject({
      status: "has_access",
      actualRole: "writer",
      accessVia: "domain",
    });
  });

  it("does not claim group membership and retains a sanitized missing failure", () => {
    const [result] = buildExpectedDriveRecipientStatuses(
      [recipient],
      [permission({ type: "group", emailAddress: "team@abbott.com" })],
      [{ email: "person@abbott.com", failureCode: "TRANSIENT_OR_UNKNOWN", lastAttemptAt: "now" }]
    );
    expect(result).toMatchObject({
      status: "missing",
      failureCode: "TRANSIENT_OR_UNKNOWN",
      hasUnverifiableGroupAccess: true,
    });
  });
});
