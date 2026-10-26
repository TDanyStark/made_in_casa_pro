/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/products", () => ({
  createProduct: jest.fn(),
  getProductsWithPagination: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "@/api/products/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import * as queries from "@/lib/queries/products";
import { ITEMS_PER_PAGE } from "@/config/constants";

const mockList = queries.getProductsWithPagination as jest.Mock;
const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];

function req(query: string) {
  return new NextRequest(`http://localhost/api/products${query ? `?${query}` : ""}`);
}

describe("GET /api/products — pagination (S25)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
    (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined });
    mockList.mockResolvedValue({ products: rows, total: 3 });
  });

  it.each(["page=0", "page=abc", "limit=0", "limit=abc", "limit=101"])(
    "returns 400 { error } for %s without querying the DB",
    async (bad) => {
      const res = await GET(req("" + bad));
      expect(res!.status).toBe(400);
      expect(await res!.json()).toEqual({ error: "Parámetros de paginación inválidos" });
      for (const fn of Object.values(queries).filter(jest.isMockFunction)) expect(fn).not.toHaveBeenCalled();
    }
  );

  it("keeps the previous default page/limit behaviour", async () => {
    const res = await GET(req(""));
    expect(res!.status).toBe(200);
    expect(await res!.json()).toEqual({
      data: rows,
      pageCount: Math.ceil(3 / ITEMS_PER_PAGE),
      currentPage: 1,
      total: 3,
    });
    expect(mockList).toHaveBeenCalledWith({ page: 1, limit: ITEMS_PER_PAGE, search: undefined, categoryId: undefined, isActive: undefined });
  });
});
