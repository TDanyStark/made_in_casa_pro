/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/projectTasks", () => ({
  getTasksCommandCenterWithPagination: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "@/api/tasks/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getTasksCommandCenterWithPagination } from "@/lib/queries/projectTasks";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetTasks = getTasksCommandCenterWithPagination as jest.MockedFunction<
  typeof getTasksCommandCenterWithPagination
>;

async function callGet(req: NextRequest) {
  const response = await GET(req);
  if (!response) throw new Error("GET handler returned undefined");
  return response;
}

describe("GET /api/tasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: 1 as never,
      response: undefined,
    } as never);
  });

  it("returns paginated payload and supports default statuses behavior", async () => {
    mockGetTasks.mockResolvedValue({
      tasks: [
        {
          id: 1,
          title: "Task",
          project_id: 8,
          project_title: "Project",
          product_name: "Producto",
          assigned_user_id: null,
          assigned_user_name: null,
          assigned_user_is_internal: null,
          task_flag: "new",
          task_type: "execution",
          status: "not_started",
          requires_quote: 0,
          assigned_at: null,
          completed_at: null,
          version_number: null,
        },
      ],
      total: 1,
    });

    const req = new NextRequest("http://localhost/api/tasks?page=2");
    const res = await callGet(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.currentPage).toBe(2);
    expect(data.total).toBe(1);
    expect(mockGetTasks).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, statuses: undefined })
    );
  });

  it("returns 400 on invalid query params", async () => {
    const req = new NextRequest("http://localhost/api/tasks?page=0");
    const res = await callGet(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/inválidos/i);
    expect(mockGetTasks).not.toHaveBeenCalled();
  });

  it("passes parsed filters to query layer", async () => {
    mockGetTasks.mockResolvedValue({ tasks: [], total: 0 });

    const req = new NextRequest(
      "http://localhost/api/tasks?page=1&creatorUserId=12&status=in_progress&status=completed&taskType=validation&taskFlag=correction"
    );
    await callGet(req);

    expect(mockGetTasks).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorUserId: 12,
        statuses: ["in_progress", "completed"],
        taskType: "validation",
        taskFlag: "correction",
      })
    );
  });
});
