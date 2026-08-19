/**
 * @jest-environment node
 */

jest.mock("googleapis", () => {
  const listMock = jest.fn();
  const createMock = jest.fn();
  const filesGetMock = jest.fn();
  const permissionsListMock = jest.fn();
  const permissionsCreateMock = jest.fn();
  const permissionsUpdateMock = jest.fn();
  const permissionsDeleteMock = jest.fn();

  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => ({
          setCredentials: jest.fn(),
          getAccessToken: jest.fn().mockResolvedValue({ token: "access-token" }),
        })),
      },
      drive: jest.fn().mockReturnValue({
        files: {
          list: listMock,
          create: createMock,
          get: filesGetMock,
        },
        permissions: {
          list: permissionsListMock,
          create: permissionsCreateMock,
          update: permissionsUpdateMock,
          delete: permissionsDeleteMock,
        },
      }),
    },
    __listMock: listMock,
    __createMock: createMock,
    __filesGetMock: filesGetMock,
    __permissionsListMock: permissionsListMock,
    __permissionsCreateMock: permissionsCreateMock,
    __permissionsUpdateMock: permissionsUpdateMock,
    __permissionsDeleteMock: permissionsDeleteMock,
  };
});

jest.mock("@/lib/queries/settings", () => ({
  getAppSettings: jest.fn(),
}));

import {
  findFolderByName,
  createProjectFolders,
  addDriveFolderPermission,
  deleteDriveFolderPermission,
  listDriveFolderPermissions,
  syncDriveFolderAccess,
} from "@/lib/services/googleDrive";
import { getAppSettings } from "@/lib/queries/settings";

async function getMocks() {
  const mod = (await import("googleapis")) as unknown as {
    __listMock: jest.Mock;
    __createMock: jest.Mock;
    __filesGetMock: jest.Mock;
    __permissionsListMock: jest.Mock;
    __permissionsCreateMock: jest.Mock;
    __permissionsUpdateMock: jest.Mock;
    __permissionsDeleteMock: jest.Mock;
  };
  return {
    listMock: mod.__listMock,
    createMock: mod.__createMock,
    filesGetMock: mod.__filesGetMock,
    permissionsListMock: mod.__permissionsListMock,
    permissionsCreateMock: mod.__permissionsCreateMock,
    permissionsUpdateMock: mod.__permissionsUpdateMock,
    permissionsDeleteMock: mod.__permissionsDeleteMock,
  };
}

function filesResult(files: { id: string; name: string }[]) {
  return { data: { files } };
}

describe("googleDrive service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAppSettings as jest.Mock).mockResolvedValue({
      google_oauth_client_id: "client-id",
      google_oauth_client_secret: "client-secret",
      google_oauth_refresh_token: "refresh-token",
      google_oauth_connected_email: "connected@test.com",
    });
  });

  describe("folder permissions", () => {
    it("paginates ACL entries and protects owner, inherited, and connected-account permissions", async () => {
      const { filesGetMock, permissionsListMock } = await getMocks();
      filesGetMock.mockResolvedValue({ data: { capabilities: { canShare: true } } });
      permissionsListMock
        .mockResolvedValueOnce({ data: { nextPageToken: "next", permissions: [
          { id: "owner", type: "user", role: "owner", emailAddress: "owner@test.com" },
          { id: "direct", type: "user", role: "writer", emailAddress: "person@test.com" },
          { id: "connected", type: "user", role: "writer", emailAddress: "connected@test.com" },
        ] } })
        .mockResolvedValueOnce({ data: { permissions: [
          { id: "inherited", type: "group", role: "reader", emailAddress: "group@test.com", permissionDetails: [{ inherited: true }] },
        ] } });

      const result = await listDriveFolderPermissions("folder-1");
      expect(permissionsListMock).toHaveBeenCalledTimes(2);
      expect(result.permissions.find((item) => item.id === "owner")?.canDelete).toBe(false);
      expect(result.permissions.find((item) => item.id === "direct")?.canDelete).toBe(true);
      expect(result.permissions.find((item) => item.id === "connected")?.canDelete).toBe(false);
      expect(result.permissions.find((item) => item.id === "inherited")?.canDelete).toBe(false);
    });

    it("normalizes a manual email and uses the selected role", async () => {
      const { filesGetMock, permissionsListMock, permissionsCreateMock } = await getMocks();
      filesGetMock.mockResolvedValue({ data: { capabilities: { canShare: true } } });
      permissionsListMock.mockResolvedValue({ data: { permissions: [] } });
      permissionsCreateMock.mockResolvedValue({ data: { id: "new" } });

      await addDriveFolderPermission("folder-1", " Person@Example.COM ", "reader");
      expect(permissionsCreateMock).toHaveBeenCalledWith(expect.objectContaining({
        fileId: "folder-1",
        supportsAllDrives: true,
        requestBody: { type: "user", role: "reader", emailAddress: "person@example.com" },
      }));
    });

    it("refuses deletion of an inherited permission", async () => {
      const { filesGetMock, permissionsListMock, permissionsDeleteMock } = await getMocks();
      filesGetMock.mockResolvedValue({ data: { capabilities: { canShare: true } } });
      permissionsListMock.mockResolvedValue({ data: { permissions: [
        { id: "inherited", type: "user", role: "writer", permissionDetails: [{ inherited: true }] },
      ] } });
      await expect(deleteDriveFolderPermission("folder-1", "inherited")).rejects.toThrow(/heredado/i);
      expect(permissionsDeleteMock).not.toHaveBeenCalled();
    });

    it("continues syncing later recipients after one permission creation fails", async () => {
      jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const { filesGetMock, permissionsListMock, permissionsCreateMock } = await getMocks();
      filesGetMock.mockResolvedValue({ data: { capabilities: { canShare: true } } });
      permissionsListMock.mockResolvedValue({ data: { permissions: [] } });
      permissionsCreateMock
        .mockRejectedValueOnce(new Error("sensitive provider response"))
        .mockResolvedValueOnce({ data: { id: "second" } });

      await expect(syncDriveFolderAccess("folder-1", ["first@test.com", "second@test.com"]))
        .resolves.toEqual({
          code: "DRIVE_ACCESS_SYNC_FAILED",
          message: "No se pudieron sincronizar todos los accesos de Google Drive.",
        });
      expect(permissionsCreateMock).toHaveBeenCalledTimes(2);
      expect(permissionsCreateMock).toHaveBeenLastCalledWith(expect.objectContaining({
        requestBody: expect.objectContaining({ emailAddress: "second@test.com" }),
      }));
    });

    it("adds a direct writer permission when shared-drive access is only inherited reader", async () => {
      const { filesGetMock, permissionsListMock, permissionsCreateMock, permissionsUpdateMock } = await getMocks();
      filesGetMock.mockResolvedValue({ data: { capabilities: { canShare: true } } });
      permissionsListMock.mockResolvedValue({ data: { permissions: [
        {
          id: "inherited-reader",
          type: "user",
          role: "reader",
          emailAddress: "person@test.com",
          permissionDetails: [{ inherited: true, inheritedFrom: "shared-drive" }],
        },
      ] } });
      permissionsCreateMock.mockResolvedValue({ data: { id: "direct-writer" } });

      await expect(syncDriveFolderAccess("folder-1", ["person@test.com"])).resolves.toBeNull();
      expect(permissionsUpdateMock).not.toHaveBeenCalled();
      expect(permissionsCreateMock).toHaveBeenCalledWith(expect.objectContaining({
        supportsAllDrives: true,
        requestBody: { type: "user", role: "writer", emailAddress: "person@test.com" },
      }));
    });
  });

  describe("findFolderByName()", () => {
    it("returns the id and count 1 when exactly one folder matches", async () => {
      const { listMock } = await getMocks();
      listMock.mockResolvedValueOnce(filesResult([{ id: "folder-1", name: "Acme" }]));

      const drive = (await (await import("googleapis")).google.drive({} as never)) as never;
      const result = await findFolderByName(drive, "Acme", "parent-id");

      expect(result).toEqual({ id: "folder-1", count: 1 });
      expect(listMock).toHaveBeenCalledWith(
        expect.objectContaining({
          q: expect.stringContaining("'parent-id' in parents"),
        })
      );
    });

    it("returns id null and count 0 when nothing matches", async () => {
      const { listMock } = await getMocks();
      listMock.mockResolvedValueOnce(filesResult([]));

      const drive = (await import("googleapis")).google.drive({} as never) as never;
      const result = await findFolderByName(drive, "Missing", "parent-id");

      expect(result).toEqual({ id: null, count: 0 });
    });

    it("returns the first id but the total count when there are duplicates", async () => {
      const { listMock } = await getMocks();
      listMock.mockResolvedValueOnce(
        filesResult([
          { id: "folder-1", name: "Acme" },
          { id: "folder-2", name: "Acme" },
          { id: "folder-3", name: "Acme" },
        ])
      );

      const drive = (await import("googleapis")).google.drive({} as never) as never;
      const result = await findFolderByName(drive, "Acme", "parent-id");

      expect(result).toEqual({ id: "folder-1", count: 3 });
    });
  });

  describe("findOrCreateFolder() regression (via createProjectFolders)", () => {
    it("creates folders on a full miss (behavior unchanged)", async () => {
      const { listMock, createMock } = await getMocks();
      // 4 lookups (root, client, brand, project), all miss
      listMock
        .mockResolvedValueOnce(filesResult([]))
        .mockResolvedValueOnce(filesResult([]))
        .mockResolvedValueOnce(filesResult([]))
        .mockResolvedValueOnce(filesResult([]));

      createMock
        .mockResolvedValueOnce({ data: { id: "root-id" } })
        .mockResolvedValueOnce({ data: { id: "client-id" } })
        .mockResolvedValueOnce({ data: { id: "brand-id" } })
        .mockResolvedValueOnce({ data: { id: "project-id" } });

      const result = await createProjectFolders({
        clientName: "Acme Corp",
        brandName: "Acme Brand",
        projectTitle: "Campaign Q1",
      });

      expect(result).toEqual({
        projectFolderId: "project-id",
        projectFolderUrl: "https://drive.google.com/drive/folders/project-id",
      });
      expect(createMock).toHaveBeenCalledTimes(4);
      expect(createMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({ name: "Campaign Q1", parents: ["brand-id"] }),
        })
      );
    });

    it("reuses existing folders on a full hit without creating anything", async () => {
      const { listMock, createMock } = await getMocks();
      listMock
        .mockResolvedValueOnce(filesResult([{ id: "root-id", name: "Made In Casa" }]))
        .mockResolvedValueOnce(filesResult([{ id: "client-id", name: "Acme Corp" }]))
        .mockResolvedValueOnce(filesResult([{ id: "brand-id", name: "Acme Brand" }]))
        .mockResolvedValueOnce(filesResult([{ id: "project-id", name: "Campaign Q1" }]));

      const result = await createProjectFolders({
        clientName: "Acme Corp",
        brandName: "Acme Brand",
        projectTitle: "Campaign Q1",
      });

      expect(result).toEqual({
        projectFolderId: "project-id",
        projectFolderUrl: "https://drive.google.com/drive/folders/project-id",
      });
      expect(createMock).not.toHaveBeenCalled();
    });
  });

  describe("createProjectFolders() partial-sharing regression", () => {
    it("resolves with the created folder data plus a safe driveWarning when some recipients fail to sync, instead of rejecting", async () => {
      // Regression guard: previously a partial-sharing failure rejected the
      // whole promise even though the folder chain was created successfully,
      // which made the /api/drive/create-folder route return a 500 and
      // blocked the wizard from ever creating the project.
      jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const {
        listMock,
        createMock,
        filesGetMock,
        permissionsListMock,
        permissionsCreateMock,
      } = await getMocks();

      listMock
        .mockResolvedValueOnce(filesResult([]))
        .mockResolvedValueOnce(filesResult([]))
        .mockResolvedValueOnce(filesResult([]))
        .mockResolvedValueOnce(filesResult([]));

      createMock
        .mockResolvedValueOnce({ data: { id: "root-id" } })
        .mockResolvedValueOnce({ data: { id: "client-id" } })
        .mockResolvedValueOnce({ data: { id: "brand-id" } })
        .mockResolvedValueOnce({ data: { id: "project-id" } });

      filesGetMock.mockResolvedValue({ data: { capabilities: { canShare: true } } });
      permissionsListMock.mockResolvedValue({ data: { permissions: [] } });
      permissionsCreateMock
        .mockRejectedValueOnce(new Error("sensitive provider response"))
        .mockResolvedValueOnce({ data: { id: "second" } });

      await expect(
        createProjectFolders({
          clientName: "Acme Corp",
          brandName: "Acme Brand",
          projectTitle: "Campaign Q1",
          shareEmails: ["first@test.com", "second@test.com"],
        })
      ).resolves.toEqual({
        projectFolderId: "project-id",
        projectFolderUrl: "https://drive.google.com/drive/folders/project-id",
        driveWarning: {
          code: "DRIVE_ACCESS_SYNC_FAILED",
          message: "No se pudieron sincronizar todos los accesos de Google Drive.",
        },
      });

      // Both folder creation and the (partially failing) sharing step ran.
      expect(createMock).toHaveBeenCalledTimes(4);
      expect(permissionsCreateMock).toHaveBeenCalledTimes(2);
    });

    it("omits driveWarning entirely when sharing succeeds for every recipient", async () => {
      const {
        listMock,
        createMock,
        filesGetMock,
        permissionsListMock,
        permissionsCreateMock,
      } = await getMocks();

      listMock
        .mockResolvedValueOnce(filesResult([]))
        .mockResolvedValueOnce(filesResult([]))
        .mockResolvedValueOnce(filesResult([]))
        .mockResolvedValueOnce(filesResult([]));

      createMock
        .mockResolvedValueOnce({ data: { id: "root-id" } })
        .mockResolvedValueOnce({ data: { id: "client-id" } })
        .mockResolvedValueOnce({ data: { id: "brand-id" } })
        .mockResolvedValueOnce({ data: { id: "project-id" } });

      filesGetMock.mockResolvedValue({ data: { capabilities: { canShare: true } } });
      permissionsListMock.mockResolvedValue({ data: { permissions: [] } });
      permissionsCreateMock.mockResolvedValue({ data: { id: "shared" } });

      const result = await createProjectFolders({
        clientName: "Acme Corp",
        brandName: "Acme Brand",
        projectTitle: "Campaign Q1",
        shareEmails: ["first@test.com"],
      });

      expect(result).toEqual({
        projectFolderId: "project-id",
        projectFolderUrl: "https://drive.google.com/drive/folders/project-id",
      });
      expect(result).not.toHaveProperty("driveWarning");
    });

    it("still rejects when the folder chain itself cannot be created (real failure, not a sharing issue)", async () => {
      const { listMock, createMock } = await getMocks();
      listMock.mockResolvedValueOnce(filesResult([]));
      createMock.mockRejectedValueOnce(new Error("Drive API unavailable"));

      await expect(
        createProjectFolders({
          clientName: "Acme Corp",
          brandName: "Acme Brand",
          projectTitle: "Campaign Q1",
          shareEmails: ["first@test.com"],
        })
      ).rejects.toThrow("Drive API unavailable");
    });
  });
});
