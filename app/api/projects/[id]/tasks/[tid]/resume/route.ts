import { NextRequest } from "next/server";
import { resumeTask } from "@/lib/queries/projectTasks";
import { handleTaskStateChange } from "../taskStateChange";

type Params = { params: Promise<{ id: string; tid: string }> };

/**
 * POST /api/projects/[id]/tasks/[tid]/resume
 * Transitions a task from 'paused' to 'in_progress'; the assignee's current
 * in-progress task is paused. Allowed for the assignee or a leadership role.
 */
export async function POST(request: NextRequest, context: Params) {
  return handleTaskStateChange(request, context, {
    change: resumeTask,
    forbiddenMessage: "No tienes permiso para reanudar esta tarea",
    successMessage: "Tarea reanudada correctamente",
    fallbackErrorMessage: "Error al reanudar tarea",
  });
}
