/**
 * @jest-environment node
 */

jest.mock("googleapis", () => {
  const listMock = jest.fn();
  const createMock = jest.fn();

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
        },
        permissions: {
          create: jest.fn().mockResolvedValue({}),
        },
      }),
    },
    __listMock: listMock,
    __createMock: createMock,
  };
});

jest.mock("@/lib/queries/settings", () => ({
  getAppSettings: jest.fn().mockResolvedValue({
    google_oauth_client_id: "client-id",
    google_oauth_client_secret: "client-secret",
    google_oauth_refresh_token: "refresh-token",
  }),
}));

import {
  findFolderByName,
  createProjectFolders,
} from "@/lib/services/googleDrive";

async function getMocks() {
  const mod = (await import("googleapis")) as unknown as {
    __listMock: jest.Mock;
    __createMock: jest.Mock;
  };
  return { listMock: mod.__listMock, createMock: mod.__createMock };
}

function filesResult(files: { id: string; name: string }[]) {
  return { data: { files } };
}

describe("googleDrive service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
