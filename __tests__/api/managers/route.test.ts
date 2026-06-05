/**
 * Integration tests for POST /api/managers
 *
 * Focus: the phone field is now OPTIONAL — only email is required. A manager
 * can be created without a phone number.
 *
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/managers", () => ({
  createManager: jest.fn(),
  getManagerByEmail: jest.fn(),
  getManagersWithPagination: jest.fn(),
}));

jest.mock("@/lib/queries/clients", () => ({
  getClientById: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/managers/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { createManager, getManagerByEmail } from "@/lib/queries/managers";
import { getClientById } from "@/lib/queries/clients";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockCreateManager = createManager as jest.MockedFunction<typeof createManager>;
const mockGetManagerByEmail = getManagerByEmail as jest.MockedFunction<typeof getManagerByEmail>;
const mockGetClientById = getClientById as jest.MockedFunction<typeof getClientById>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/managers", {
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

describe("POST /api/managers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: 3 as never,
      response: undefined,
    } as never);
    mockGetClientById.mockResolvedValue({ id: 1, name: "ACME" } as never);
    mockGetManagerByEmail.mockResolvedValue(null);
  });

  it("creates a manager WITHOUT a phone (phone is optional)", async () => {
    mockCreateManager.mockResolvedValue({ id: 50, client_id: 1, name: "Bob", email: "bob@test.com" } as never);

    const res = await callPost(
      makeRequest({
        client_id: 1,
        name: "Bob",
        email: "bob@test.com",
        biography: "",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe(50);
    expect(mockCreateManager).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Bob", email: "bob@test.com" })
    );
  });

  it("creates a manager WITH a phone when provided", async () => {
    mockCreateManager.mockResolvedValue({ id: 51, client_id: 1, name: "Ana", email: "ana@test.com" } as never);

    const res = await callPost(
      makeRequest({
        client_id: 1,
        name: "Ana",
        email: "ana@test.com",
        phone: "+51 999 888 777",
        biography: "",
      })
    );

    expect(res.status).toBe(201);
    expect(mockCreateManager).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+51 999 888 777" })
    );
  });

  it("still requires a valid email (rejects missing email with 400)", async () => {
    const res = await callPost(
      makeRequest({
        client_id: 1,
        name: "NoEmail",
        biography: "",
      })
    );

    expect(res.status).toBe(400);
    expect(mockCreateManager).not.toHaveBeenCalled();
  });
});
