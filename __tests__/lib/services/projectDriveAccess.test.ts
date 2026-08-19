/** @jest-environment node */

jest.mock("@/lib/queries/projects", () => ({
  getProjectById: jest.fn(),
  getProjectStakeholderEmails: jest.fn(),
}));
jest.mock("@/lib/services/googleDrive", () => ({
  syncDriveFolderAccess: jest.fn(),
}));

import { getProjectById, getProjectStakeholderEmails } from "@/lib/queries/projects";
import { syncDriveFolderAccess } from "@/lib/services/googleDrive";
import { syncProjectDriveAccess } from "@/lib/services/projectDriveAccess";

describe("syncProjectDriveAccess", () => {
  beforeEach(() => jest.clearAllMocks());

  it("resolves the folder and current stakeholder set server-side", async () => {
    (getProjectById as jest.Mock).mockResolvedValue({ id: 8, drive_folder_id: "folder-8" });
    (getProjectStakeholderEmails as jest.Mock).mockResolvedValue(["a@test.com", "b@test.com"]);
    (syncDriveFolderAccess as jest.Mock).mockResolvedValue(null);
    await expect(syncProjectDriveAccess(8)).resolves.toBeNull();
    expect(syncDriveFolderAccess).toHaveBeenCalledWith("folder-8", ["a@test.com", "b@test.com"]);
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
