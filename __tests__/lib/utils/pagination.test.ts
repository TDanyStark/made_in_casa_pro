/**
 * @jest-environment node
 */

import { parsePagination, PAGINATION_ERROR, MAX_PAGE_LIMIT } from "@/lib/utils/pagination";
import { ITEMS_PER_PAGE } from "@/config/constants";

function parse(query: string, options?: { maxLimit?: number }) {
  return parsePagination(new URLSearchParams(query), options);
}

describe("parsePagination()", () => {
  it("defaults to page 1 and ITEMS_PER_PAGE when no params are given", () => {
    expect(parse("")).toEqual({ success: true, page: 1, limit: ITEMS_PER_PAGE });
  });

  it("treats empty values as missing (previous parseInt fallback)", () => {
    expect(parse("page=&limit=")).toEqual({ success: true, page: 1, limit: ITEMS_PER_PAGE });
  });

  it("coerces valid numeric strings", () => {
    expect(parse("page=3&limit=25")).toEqual({ success: true, page: 3, limit: 25 });
  });

  it("accepts the limit boundaries 1 and the cap", () => {
    expect(parse("limit=1")).toEqual({ success: true, page: 1, limit: 1 });
    expect(parse(`limit=${MAX_PAGE_LIMIT}`)).toEqual({ success: true, page: 1, limit: MAX_PAGE_LIMIT });
    expect(MAX_PAGE_LIMIT).toBe(100);
  });

  it.each([
    ["page=0"],
    ["page=-1"],
    ["page=abc"],
    ["page=1.5"],
    ["limit=0"],
    ["limit=-5"],
    ["limit=abc"],
    ["limit=2.5"],
    ["limit=101"],
  ])("rejects %s with 400 { error }", async (query) => {
    const result = parse(query);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.response.status).toBe(400);
    expect(await result.response.json()).toEqual({ error: PAGINATION_ERROR });
  });

  it("honours a custom maxLimit", () => {
    expect(parse("limit=500", { maxLimit: 500 })).toEqual({ success: true, page: 1, limit: 500 });
    expect(parse("limit=501", { maxLimit: 500 }).success).toBe(false);
  });

  it("uses an exact Spanish error message", () => {
    expect(PAGINATION_ERROR).toBe("Parámetros de paginación inválidos");
  });
});
