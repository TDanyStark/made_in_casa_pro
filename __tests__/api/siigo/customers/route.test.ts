/**
 * @jest-environment node
 */
// S6: /api/siigo/customers validates method and OPERATIONS_ROLES.
jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/siigo-customers", () => ({
  getSiigoCustomers: jest.fn(),
  searchSiigoCustomersByName: jest.fn(),
  searchSiigoCustomerByIdentification: jest.fn(),
}));

import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/api/siigo/customers/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getSiigoCustomers } from "@/lib/queries/siigo-customers";
import { OPERATIONS_ROLES } from "@/lib/role-groups";

beforeEach(() => {
  jest.clearAllMocks();
  (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
  (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined });
});

describe("GET /api/siigo/customers", () => {
  it("lists customers for an operations role (previous behavior)", async () => {
    (getSiigoCustomers as jest.Mock).mockResolvedValue({ results: [] });
    const req = new NextRequest("http://localhost/api/siigo/customers?page=2&pageSize=10");

    const res = (await GET(req))!;

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [] });
    expect(getSiigoCustomers).toHaveBeenCalledWith({ page: 2, pageSize: 10 });
    expect(validateHttpMethod).toHaveBeenCalledWith(req, ["GET"]);
    expect(validateApiRole).toHaveBeenCalledWith(req, OPERATIONS_ROLES);
  });

  it("returns the role response and does not call Siigo for a collaborator", async () => {
    (validateApiRole as jest.Mock).mockResolvedValue({
      isAuthorized: false,
      userRole: 4,
      response: NextResponse.json({ error: "Acceso prohibido" }, { status: 403 }),
    });

    const res = (await GET(new NextRequest("http://localhost/api/siigo/customers")))!;

    expect(res.status).toBe(403);
    expect(getSiigoCustomers).not.toHaveBeenCalled();
  });
});
