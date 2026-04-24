/**
 * @jest-environment node
 */

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(),
}));

jest.mock("@/lib/permissions", () => ({
  publicRoutes: ["/"],
  checkRoutePermission: jest.fn().mockReturnValue(true),
}));

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import middleware from "../middleware";
import { UserRole } from "@/lib/definitions";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;

describe("middleware connect-email route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects unauthenticated users from /connect-email to login", async () => {
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue(undefined),
    } as never);

    const response = await middleware(new NextRequest("http://localhost/connect-email"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("allows authenticated users to access /connect-email", async () => {
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: "session-token" }),
    } as never);
    mockDecrypt.mockResolvedValue({ id: 7, email: "user@test.com", rol_id: UserRole.ADMIN } as never);

    const response = await middleware(new NextRequest("http://localhost/connect-email"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
