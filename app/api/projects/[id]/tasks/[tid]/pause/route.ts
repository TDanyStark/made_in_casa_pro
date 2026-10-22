import { NextRequest } from "next/server";
import { pauseTask } from "@/lib/queries/projectTasks";
import { handleTaskStateChange } from "../taskStateChange";

type Params = { params: Promise<{ id: string; tid: string }> };

/**
 * POST /api/projects/[id]/tasks/[tid]/pause
 * Transitions a task from 'in_progress' to 'paused'.
 * Allowed for the assignee or a leadership role.
 */
export async function POST(request: NextRequest, context: Params) {
  return handleTaskStateChange(request, context, {
    change: pauseTask,
    forbiddenMessage: "No tienes permiso para pausar esta tarea",
    successMessage: "Tarea pausada correctamente",
    fallbackErrorMessage: "Error al pausar tarea",
  });
}
