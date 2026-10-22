import { getSafeRedirectPath, LOGIN_REDIRECT_PARAM } from "@/lib/utils/safe-redirect";

describe("getSafeRedirectPath", () => {
  it("uses 'next' as the query param name", () => {
    expect(LOGIN_REDIRECT_PARAM).toBe("next");
  });

  it("accepts internal paths with query string and hash", () => {
    expect(getSafeRedirectPath("/projects/15")).toBe("/projects/15");
    expect(getSafeRedirectPath("/projects/15?tab=tasks#t3")).toBe("/projects/15?tab=tasks#t3");
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["/"],
    ["projects/15"],
    ["https://evil.com/projects"],
    ["//evil.com"],
    ["/\\evil.com"],
    ["/projects\\..\\x"],
    ["javascript:alert(1)"],
    ["/api/users"],
    ["/connect-email"],
  ])("rejects unsafe or pointless target %p", (value) => {
    expect(getSafeRedirectPath(value as string | null | undefined)).toBeNull();
  });
});
