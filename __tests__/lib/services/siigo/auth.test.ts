/**
 * @jest-environment node
 */
// S7: the Siigo token is never logged, requests time out, non-JSON errors are handled.
type AuthModule = typeof import("@/lib/services/siigo/auth");

function loadAuth(): AuthModule {
  let mod: AuthModule | undefined;
  jest.isolateModules(() => {
    mod = require("@/lib/services/siigo/auth");
  });
  return mod!;
}

const TOKEN = "super-secret-siigo-token";
const fetchMock = jest.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  process.env.SIIGO_USERNAME = "user";
  process.env.SIIGO_ACCESS_KEY = "key";
});

describe("getSiigoToken()", () => {
  it("reuses the cached token without logging it", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ access_token: TOKEN, expires_in: 86400 }));
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const { getSiigoToken } = loadAuth();

    expect(await getSiigoToken()).toBe(TOKEN);
    expect(await getSiigoToken()).toBe(TOKEN);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify([...logSpy.mock.calls, ...(console.error as jest.Mock).mock.calls]);
    expect(logged).not.toContain(TOKEN);
  });

  it("sends the auth request with an abort timeout signal", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ access_token: TOKEN, expires_in: 86400 }));
    const { getSiigoToken } = loadAuth();

    await getSiigoToken();

    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("reports the Siigo message on a JSON error body (previous behavior)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ Status: 401, Errors: [{ Message: "Bad credentials" }] }, 401));
    const { getSiigoToken } = loadAuth();

    await expect(getSiigoToken()).rejects.toThrow("Error al autenticar con Siigo: Bad credentials");
  });

  it("does not crash parsing a non-JSON error body", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 502, statusText: "Bad Gateway" }));
    const { getSiigoToken } = loadAuth();

    await expect(getSiigoToken()).rejects.toThrow("Error al autenticar con Siigo: Bad Gateway");
  });
});
