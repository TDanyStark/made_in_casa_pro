import "server-only";
import { redirect } from "next/navigation";
import { getCurrentSession } from "./api-session";
import { isInternalCollaborator } from "@/lib/queries/users";

/**
 * Middleware only knows the role from the JWT, so the internal flag is checked
 * here: internal collaborators never quote and are sent back to the dashboard.
 */
export async function redirectInternalCollaboratorFromQuotes(): Promise<void> {
  const session = await getCurrentSession();
  if (session?.id && (await isInternalCollaborator(Number(session.id)))) {
    redirect("/dashboard");
  }
}
