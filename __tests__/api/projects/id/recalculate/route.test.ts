/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/lib/session", () => ({ decrypt: jest.fn() }));

jest.mock("@/lib/services/notificationEngine", () => ({
  recalculateProgressAndNotify: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/projects/[id]/recalculate/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { recalculateProgressAndNotify } from "@/lib/services/notificationEngine";

const mockRecalc = recalculateProgressAndNotify as jest.Mock;

function callPost() {
  return POST(new NextRequest("http://localhost/api/projects/7/recalculate", { method: "POST" }), {
    params: Promise.resolve({ id: "7" }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
  (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined });
  (cookies as jest.Mock).mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "token" }) });
  (decrypt as jest.Mock).mockResolvedValue({ id: 4 });
});

describe("POST /api/projects/[id]/recalculate", () => {
  it("returns { progress } (previous contract) and recalculates with the caller as ready-to-close actor", async () => {
    mockRecalc.mockResolvedValue(100);

    const res = await callPost();

    expect(res!.status).toBe(200);
    expect(await res!.json()).toEqual({ progress: 100 });
    expect(mockRecalc).toHaveBeenCalledWith(7, 4);
  });

  it("returns 500 with the previous message when recalculation fails", async () => {
    mockRecalc.mockRejectedValue(new Error("DB down"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await callPost();

    expect(res!.status).toBe(500);
    expect(await res!.json()).toEqual({ error: "Error al recalcular progreso" });
  });
});

// S6: recalculation is restricted to PROJECT_EDIT_ROLES.
describe("POST /api/projects/[id]/recalculate roles", () => {
  it("validates POST and PROJECT_EDIT_ROLES", async () => {
    mockRecalc.mockResolvedValue(10);
    const { PROJECT_EDIT_ROLES } = jest.requireActual("@/lib/role-groups");

    await callPost();

    expect(validateHttpMethod).toHaveBeenCalledWith(expect.anything(), ["POST"]);
    expect(validateApiRole).toHaveBeenCalledWith(expect.anything(), PROJECT_EDIT_ROLES);
  });

  it("returns the role response and does not recalculate for a collaborator", async () => {
    const { NextResponse } = jest.requireActual("next/server");
    (validateApiRole as jest.Mock).mockResolvedValue({
      isAuthorized: false,
      userRole: 4,
      response: NextResponse.json({ error: "Acceso prohibido" }, { status: 403 }),
    });

    const res = await callPost();

    expect(res!.status).toBe(403);
    expect(mockRecalc).not.toHaveBeenCalled();
  });
});
