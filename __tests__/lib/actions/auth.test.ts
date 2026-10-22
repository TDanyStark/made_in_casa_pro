/**
 * @jest-environment node
 */

jest.mock("next/navigation", () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

jest.mock("@/lib/session", () => ({
  createSession: jest.fn().mockResolvedValue(undefined),
  deleteSession: jest.fn(),
}));

jest.mock("@/lib/queries/users", () => ({
  getUserByEmail: jest.fn(),
}));

jest.mock("@/lib/queries/userEmailConnections", () => ({
  getUserConnectedEmailStatus: jest.fn(),
}));

jest.mock("bcrypt", () => ({
  compare: jest.fn(),
}));

import { login } from "@/lib/actions/auth";
import { createSession } from "@/lib/session";
import { getUserByEmail } from "@/lib/queries/users";
import { getUserConnectedEmailStatus } from "@/lib/queries/userEmailConnections";
import bcrypt from "bcrypt";

const mockGetUserByEmail = getUserByEmail as jest.Mock;
const mockGmailStatus = getUserConnectedEmailStatus as jest.Mock;
const mockCompare = bcrypt.compare as jest.Mock;
const mockCreateSession = createSession as jest.Mock;

function form(next?: string) {
  const fd = new FormData();
  fd.set("email", "ana@test.com");
  fd.set("password", "secret123");
  if (next !== undefined) fd.set("next", next);
  return fd;
}

async function loginRedirect(fd: FormData): Promise<string> {
  try {
    await login({ errors: {} } as never, fd);
  } catch (error) {
    return (error as Error).message.replace("NEXT_REDIRECT:", "");
  }
  throw new Error("login did not redirect");
}

describe("login() redirect target", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserByEmail.mockResolvedValue([
      { id: 5, name: "Ana", email: "ana@test.com", rol_id: 3, password: "hash" },
    ]);
    mockCompare.mockResolvedValue(true);
    mockGmailStatus.mockResolvedValue(true);
  });

  it("redirects to the saved internal path after a successful login", async () => {
    expect(await loginRedirect(form("/projects/15"))).toBe("/projects/15");
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
  });

  it("skips /connect-email when a saved path exists and Gmail is not connected", async () => {
    mockGmailStatus.mockResolvedValue(false);
    expect(await loginRedirect(form("/projects/15"))).toBe("/projects/15");
  });

  it("keeps /connect-email when there is no saved path and Gmail is not connected", async () => {
    mockGmailStatus.mockResolvedValue(false);
    expect(await loginRedirect(form())).toBe("/connect-email");
  });

  it("keeps /dashboard when there is no saved path", async () => {
    expect(await loginRedirect(form())).toBe("/dashboard");
  });

  it("ignores an external target and falls back to /dashboard", async () => {
    expect(await loginRedirect(form("https://evil.com"))).toBe("/dashboard");
    expect(await loginRedirect(form("//evil.com"))).toBe("/dashboard");
  });

  it("does not log in or redirect when credentials are wrong, even with a saved path", async () => {
    mockCompare.mockResolvedValue(false);
    const state = await login({ errors: {} } as never, form("/projects/15"));
    expect(state).toEqual(
      expect.objectContaining({ errors: { general: "Datos incorrectos" } })
    );
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});
