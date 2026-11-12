/**
 * @jest-environment node
 */
jest.mock("server-only", () => ({}));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));
jest.mock("@/lib/services/api-session", () => ({ getCurrentSession: jest.fn() }));
jest.mock("@/lib/queries/users", () => ({ isInternalCollaborator: jest.fn() }));

import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/services/api-session";
import { isInternalCollaborator } from "@/lib/queries/users";
import { redirectInternalCollaboratorFromQuotes } from "@/lib/services/quotes-page-guard";

describe("redirectInternalCollaboratorFromQuotes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCurrentSession as jest.Mock).mockResolvedValue({ id: 9 });
  });

  it("redirects an internal collaborator to /dashboard", async () => {
    (isInternalCollaborator as jest.Mock).mockResolvedValue(true);
    await redirectInternalCollaboratorFromQuotes();
    expect(isInternalCollaborator).toHaveBeenCalledWith(9);
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("lets an external collaborator stay", async () => {
    (isInternalCollaborator as jest.Mock).mockResolvedValue(false);
    await redirectInternalCollaboratorFromQuotes();
    expect(redirect).not.toHaveBeenCalled();
  });
});
