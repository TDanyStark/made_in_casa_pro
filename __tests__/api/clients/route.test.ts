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
