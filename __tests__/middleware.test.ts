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

describe("middleware login redirect target", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function anonymous() {
    mockCookies.mockResolvedValue({ get: jest.fn().mockReturnValue(undefined) } as never);
  }

  function authenticated() {
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: "session-token" }),
    } as never);
    mockDecrypt.mockResolvedValue({ id: 7, email: "user@test.com", rol_id: UserRole.ADMIN } as never);
  }

  it("keeps the requested path (with query) in ?next= when redirecting to login", async () => {
    anonymous();

    const response = await middleware(new NextRequest("http://localhost/projects/15?tab=tasks"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("next")).toBe("/projects/15?tab=tasks");
  });

  it("still answers 401 JSON for unauthenticated API calls", async () => {
    anonymous();

    const response = await middleware(new NextRequest("http://localhost/api/projects"));

    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
  });

  it("sends an authenticated user on the login page to a safe ?next= target", async () => {
    authenticated();

    const response = await middleware(new NextRequest("http://localhost/?next=%2Fprojects%2F15"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/projects/15");
  });

  it("ignores an external ?next= target and goes to the dashboard", async () => {
    authenticated();

    const response = await middleware(new NextRequest("http://localhost/?next=%2F%2Fevil.com"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("keeps sending an authenticated user on the login page to the dashboard", async () => {
    authenticated();

    const response = await middleware(new NextRequest("http://localhost/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/dashboard");
  });
});
