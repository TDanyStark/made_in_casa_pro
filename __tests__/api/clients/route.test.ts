/**
 * Integration tests for POST /api/clients
 *
 * Focus: the response must include the created client (with its id) so the
 * inline "create client" flow (ClientSelect → CreateClientModal) can
 * auto-select it in the form.
 *
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/clients", () => ({
  createClient: jest.fn(),
  getClientById: jest.fn(),
  getClientsWithPagination: jest.fn(),
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { NextRequest } from "next/server";
import { POST } from "@/api/clients/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { createClient, getClientById } from "@/lib/queries/clients";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetClientById = getClientById as jest.MockedFunction<typeof getClientById>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function callPost(req: NextRequest) {
  const response = await POST(req);
  if (!response) throw new Error("POST handler returned undefined");
  return response;
}

describe("POST /api/clients", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: 3 as never,
      response: undefined,
    } as never);
  });

  it("returns 201 with the created client (id, name, country)", async () => {
    mockCreateClient.mockResolvedValue({ rows: [{ id: 77 }] } as never);
    const created = {
      id: 77,
      name: "ACME",
      country: { id: 1, name: "Colombia", flag: "co" },
    };
    mockGetClientById.mockResolvedValue(created as never);

    const res = await callPost(makeRequest({ name: "ACME", country_id: 1 }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toEqual(created);
    expect(mockCreateClient).toHaveBeenCalledWith("ACME", 1);
    expect(mockGetClientById).toHaveBeenCalledWith("77");
  });

  it("rejects invalid input with 400 and does not create a client", async () => {
    const res = await callPost(makeRequest({ name: "", country_id: 1 }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Datos de cliente inválidos");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});

describe("GET /api/clients limit", () => {
  const { GET } = jest.requireActual("@/api/clients/route") as typeof import("@/api/clients/route");
  const { getClientsWithPagination } = jest.requireMock("@/lib/queries/clients") as {
    getClientsWithPagination: jest.Mock;
  };
  const { ITEMS_PER_PAGE } = jest.requireActual("@/config/constants") as typeof import("@/config/constants");

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: 4 as never,
      response: undefined,
    } as never);
    getClientsWithPagination.mockResolvedValue({ clients: [{ id: 1, name: "A" }], total: 1 });
  });

  async function callGet(qs: string) {
    const response = await GET(new NextRequest(`http://localhost/api/clients${qs}`));
    if (!response) throw new Error("GET handler returned undefined");
    return response;
  }

  it("keeps ITEMS_PER_PAGE when no limit is given", async () => {
    const res = await callGet("?page=2&search=ab");
    expect(res.status).toBe(200);
    expect(getClientsWithPagination).toHaveBeenCalledWith({ page: 2, limit: ITEMS_PER_PAGE, search: "ab" });
    expect(await res.json()).toEqual({ data: [{ id: 1, name: "A" }], pageCount: 1, currentPage: 2, total: 1 });
  });

  it("honors a requested limit", async () => {
    await callGet("?limit=300");
    expect(getClientsWithPagination).toHaveBeenCalledWith({ page: 1, limit: 300, search: undefined });
  });

  it("caps the limit at 500", async () => {
    await callGet("?limit=5000");
    expect(getClientsWithPagination).toHaveBeenCalledWith({ page: 1, limit: 500, search: undefined });
  });

  it.each(["?limit=abc", "?limit=0", "?limit=-1"])("falls back to ITEMS_PER_PAGE for %s", async (qs) => {
    await callGet(qs);
    expect(getClientsWithPagination).toHaveBeenCalledWith({ page: 1, limit: ITEMS_PER_PAGE, search: undefined });
  });
});
