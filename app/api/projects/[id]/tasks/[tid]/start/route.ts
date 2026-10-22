import { NextRequest } from "next/server";
import { startTask } from "@/lib/queries/projectTasks";
import { handleTaskStateChange } from "../taskStateChange";

type Params = { params: Promise<{ id: string; tid: string }> };

/**
 * POST /api/projects/[id]/tasks/[tid]/start
 * Transitions a task from 'not_started' to 'in_progress'; the assignee's other
 * in-progress tasks are paused. Allowed for the assignee or a leadership role.
 */
export async function POST(request: NextRequest, context: Params) {
  return handleTaskStateChange(request, context, {
    change: startTask,
    forbiddenMessage: "No tienes permiso para iniciar esta tarea",
    successMessage: "Tarea iniciada correctamente",
    fallbackErrorMessage: "Error al iniciar tarea",
  });
}
