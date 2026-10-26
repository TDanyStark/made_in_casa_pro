/**
 * @jest-environment node
 */
// S7: Siigo API calls time out and tolerate non-JSON error bodies.
jest.mock("@/lib/services/siigo/auth", () => ({
  ...jest.requireActual("@/lib/services/siigo/auth"),
  getSiigoToken: jest.fn(async () => "token"),
  forceRenewSiigoToken: jest.fn(async () => "token2"),
}));

import { SiigoClient } from "@/lib/services/siigo/client";

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("SiigoClient.request()", () => {
  it("returns the JSON body and sends an abort timeout signal", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));

    const result = await new SiigoClient().request("/v1/customers");

    expect(result).toEqual({ ok: 1 });
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("includes the JSON error body in the error (previous behavior)", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ Errors: [{ Code: "x" }] }), { status: 400 }));

    await expect(new SiigoClient().request("/v1/customers")).rejects.toThrow(
      'Error en la API de Siigo: {"Errors":[{"Code":"x"}]}'
    );
  });

  it("does not crash on a non-JSON error body", async () => {
    fetchMock.mockResolvedValue(new Response("<html>oops</html>", { status: 503, statusText: "Service Unavailable" }));

    await expect(new SiigoClient().request("/v1/customers")).rejects.toThrow(
      "Error en la API de Siigo: 503 Service Unavailable"
    );
  });
});
