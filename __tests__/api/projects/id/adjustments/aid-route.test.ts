/**
 * @jest-environment node
 */
// S20: deleting an adjustment that is not of the URL project answers 404.
jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));
jest.mock("@/lib/queries/adjustments", () => ({ deleteProjectAdjustment: jest.fn() }));

import { NextRequest } from "next/server";
import { DELETE } from "@/api/projects/[id]/adjustments/[aid]/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { deleteProjectAdjustment } from "@/lib/queries/adjustments";

const callDelete = () =>
  DELETE(new NextRequest("http://localhost/api/projects/15/adjustments/30", { method: "DELETE" }), {
    params: Promise.resolve({ id: "15", aid: "30" }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
  (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined });
});

it("returns 404 when the adjustment is not of the project", async () => {
  (deleteProjectAdjustment as jest.Mock).mockRejectedValue(new Error("Ajuste no encontrado"));

  const res = (await callDelete())!;

  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: "Ajuste no encontrado" });
  expect(deleteProjectAdjustment).toHaveBeenCalledWith(30, 15);
});

it("keeps 400 for a completed version (previous behavior)", async () => {
  (deleteProjectAdjustment as jest.Mock).mockRejectedValue(new Error("No se puede eliminar una versión completada."));

  const res = (await callDelete())!;

  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "No se puede eliminar una versión completada." });
});

it("deletes the adjustment (previous behavior)", async () => {
  (deleteProjectAdjustment as jest.Mock).mockResolvedValue(undefined);

  const res = (await callDelete())!;

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ success: true });
});
