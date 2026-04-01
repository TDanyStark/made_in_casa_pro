/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/projectTasks", () => ({
  getMyTasksWithPagination: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "@/api/my-tasks/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getMyTasksWithPagination } from "@/lib/queries/projectTasks";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetMyTasks = getMyTasksWithPagination as jest.MockedFunction<typeof getMyTasksWithPagination>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

async function callGet(req: NextRequest) {
  const response = await GET(req);
  if (!response) throw new Error("GET handler returned undefined");
  return response;
}

describe("GET /api/my-tasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: 1 as never,
      response: undefined,
    } as never);
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: "fake-cookie" }),
    } as never);
    mockDecrypt.mockResolvedValue({ id: 9 } as never);
  });

  it("returns 200 with paginated payload for valid params", async () => {
    mockGetMyTasks.mockResolvedValue({
      tasks: [
        {
          id: 1,
          title: "Tarea",
          description: null,
          project_id: 2,
          project_title: "Proyecto",
          product_name: "Producto",
          brand_id: 5,
          brand_name: "Marca",
          creator_user_id: 3,
          creator_user_name: "Creador",
          area_id: null,
          area_name: null,
          assigned_user_id: 9,
          assigned_user_name: "Usuario",
          assigned_user_rol_id: 4,
          status: "in_progress",
          task_type: "execution",
          task_flag: "new",
          adjustment_id: null,
          version_number: 1,
          requires_quote: 0,
          assign_to_commercial: 0,
          order_index: 1,
          assigned_at: null,
          completed_at: null,
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
          quoter_ids: [],
          quote_count: 0,
          pending_quote_count: 0,
        },
      ],
      total: 1,
    });

    const req = new NextRequest(
      "http://localhost/api/my-tasks?page=1&status=in_progress&brandId=5&q=cocina"
    );
    const res = await callGet(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(
      expect.objectContaining({
        currentPage: 1,
        total: 1,
        pageCount: 1,
      })
    );
    expect(mockGetMyTasks).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 9,
        page: 1,
        statuses: ["in_progress"],
        brandId: 5,
        q: "cocina",
      })
    );
  });

  it("returns 400 on invalid page", async () => {
    const req = new NextRequest("http://localhost/api/my-tasks?page=abc");
    const res = await callGet(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/inválidos/i);
    expect(mockGetMyTasks).not.toHaveBeenCalled();
  });

  it("returns 400 on unknown status", async () => {
    const req = new NextRequest("http://localhost/api/my-tasks?status=unknown_status");
    const res = await callGet(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/inválidos/i);
    expect(mockGetMyTasks).not.toHaveBeenCalled();
  });

  it("passes all selected statuses including completed", async () => {
    mockGetMyTasks.mockResolvedValue({ tasks: [], total: 0 });

    const req = new NextRequest(
      "http://localhost/api/my-tasks?page=1&status=not_started&status=in_progress&status=blocked&status=waiting&status=completed"
    );
    const res = await callGet(req);

    expect(res.status).toBe(200);
    expect(mockGetMyTasks).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: [
          "not_started",
          "in_progress",
          "blocked",
          "waiting",
          "completed",
        ],
      })
    );
  });
});
