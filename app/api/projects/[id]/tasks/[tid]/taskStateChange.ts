import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getProjectTaskById } from "@/lib/queries/projectTasks";
import { decrypt } from "@/lib/session";
import { AUTHENTICATED_ROLES, TASK_OVERRIDE_ROLES } from "@/lib/role-groups";

type Params = { params: Promise<{ id: string; tid: string }> };

/**
 * Translates a TaskRuleError thrown by the task/quote queries into its HTTP
 * response (`{ error }` with the rule's 400/404/409). Returns null for any other
 * error. Matches by name so module mocks of the query layer keep working.
 */
export function taskRuleErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof Error) || error.name !== "TaskRuleError") return null;
  const status = (error as Error & { status?: unknown }).status;
  if (typeof status !== "number") return null;
  return NextResponse.json({ error: error.message }, { status });
}

type StateChangeResult = { success: boolean; error?: string; pausedTaskIds?: number[] };

interface StateChangeConfig {
  change: (taskId: number, userId: number) => Promise<StateChangeResult>;
  forbiddenMessage: string;
  successMessage: string;
  fallbackErrorMessage: string;
}

/**
 * Shared POST handler for start / pause / resume.
 * Allowed for the assigned user or a leadership role (TASK_OVERRIDE_ROLES).
 * Responds with `pausedTaskIds` when other tasks were paused automatically.
 */
export async function handleTaskStateChange(
  request: NextRequest,
  { params }: Params,
  config: StateChangeConfig
) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id, tid } = await params;
    const projectId = parseInt(id);
    const taskId = parseInt(tid);

    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    if (!session?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const userId = session.id;

    const task = await getProjectTaskById(taskId);
    if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    if (task.project_id !== projectId) {
      return NextResponse.json({ error: "Tarea no pertenece al proyecto" }, { status: 400 });
    }

    const isAssigned = task.assigned_user_id === userId;
    const canOverride = TASK_OVERRIDE_ROLES.includes(roleValidation.userRole);
    if (!isAssigned && !canOverride) {
      return NextResponse.json({ error: config.forbiddenMessage }, { status: 403 });
    }

    const result = await config.change(taskId, userId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      result.pausedTaskIds
        ? { message: config.successMessage, pausedTaskIds: result.pausedTaskIds }
        : { message: config.successMessage }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : config.fallbackErrorMessage;
    console.error(`${config.fallbackErrorMessage}:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
