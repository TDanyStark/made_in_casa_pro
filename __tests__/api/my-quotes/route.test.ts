/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/taskQuotes", () => ({
  getMyQuotes: jest.fn(),
  getPendingQuoteInvitations: jest.fn(),
  getPendingQuoteInvitationsCount: jest.fn(),
}));

jest.mock("@/lib/queries/users", () => ({
  isInternalCollaborator: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET as getMyQuotesRoute } from "@/api/my-quotes/route";
import { GET as getCountRoute } from "@/api/my-quotes/count/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import {
  getMyQuotes,
  getPendingQuoteInvitations,
  getPendingQuoteInvitationsCount,
} from "@/lib/queries/taskQuotes";
import { isInternalCollaborator } from "@/lib/queries/users";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

const mockIsInternal = isInternalCollaborator as jest.MockedFunction<typeof isInternalCollaborator>;

const routes = [
  { name: "GET /api/my-quotes", handler: getMyQuotesRoute, url: "http://localhost/api/my-quotes" },
  { name: "GET /api/my-quotes/count", handler: getCountRoute, url: "http://localhost/api/my-quotes/count" },
];

describe.each(routes)("$name for internal collaborators", ({ handler, url }) => {
  beforeEach(() => {
    jest.clearAllMocks();
    (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
    (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: 4, response: undefined });
    (cookies as jest.Mock).mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "cookie" }) });
    (decrypt as jest.Mock).mockResolvedValue({ id: 9 });
    (getMyQuotes as jest.Mock).mockResolvedValue([]);
    (getPendingQuoteInvitations as jest.Mock).mockResolvedValue([]);
    (getPendingQuoteInvitationsCount as jest.Mock).mockResolvedValue(2);
  });

  it("returns 403 and reads no quotes for an internal collaborator", async () => {
    mockIsInternal.mockResolvedValue(true);

    const res = (await handler(new NextRequest(url)))!;

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Los colaboradores internos no tienen cotizaciones" });
    expect(mockIsInternal).toHaveBeenCalledWith(9);
    expect(getMyQuotes).not.toHaveBeenCalled();
    expect(getPendingQuoteInvitations).not.toHaveBeenCalled();
    expect(getPendingQuoteInvitationsCount).not.toHaveBeenCalled();
  });

  it("keeps answering 200 for an external collaborator", async () => {
    mockIsInternal.mockResolvedValue(false);

    const res = (await handler(new NextRequest(url)))!;

    expect(res.status).toBe(200);
  });
});
