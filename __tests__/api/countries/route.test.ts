/**
 * Integration tests for POST /api/countries
 *
 * Focus: operations roles (admin, directivo, financiero, comercial) can now
 * create a country — previously this was admin-only, which blocked comerciales
 * from creating a country while registering a client.
 *
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/countries", () => ({
  getCountries: jest.fn(),
  createCountry: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/countries/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { createCountry } from "@/lib/queries/countries";
import { OPERATIONS_ROLES } from "@/lib/role-groups";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockCreateCountry = createCountry as jest.MockedFunction<typeof createCountry>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/countries", {
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

describe("POST /api/countries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: 3 as never, // comercial
      response: undefined,
    } as never);
  });

  it("authorizes operations roles (not admin-only) to create a country", async () => {
    mockCreateCountry.mockResolvedValue({ rows: [{ id: 7 }] } as never);

    const res = await callPost(makeRequest({ name: "Perú", flag: "pe" }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe(7);
    // The key assertion: the gate uses OPERATIONS_ROLES, which includes comercial.
    expect(mockValidateApiRole).toHaveBeenCalledWith(expect.anything(), OPERATIONS_ROLES);
    expect(mockCreateCountry).toHaveBeenCalledWith("Perú", "pe");
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await callPost(makeRequest({ name: "Perú" }));

    expect(res.status).toBe(400);
    expect(mockCreateCountry).not.toHaveBeenCalled();
  });

  it("propagates the auth response when the role is not authorized", async () => {
    const forbidden = new Response(JSON.stringify({ error: "Acceso prohibido" }), { status: 403 });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: false,
      userRole: 4 as never,
      response: forbidden as never,
    } as never);

    const res = await callPost(makeRequest({ name: "Perú", flag: "pe" }));

    expect(res.status).toBe(403);
    expect(mockCreateCountry).not.toHaveBeenCalled();
  });
});
