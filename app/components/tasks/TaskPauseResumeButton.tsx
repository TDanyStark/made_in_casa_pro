"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, PauseCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { post } from "@/lib/services/apiService";
import type { ProjectTaskStatus } from "@/lib/definitions";

type StateChangeResponse = { message?: string; pausedTaskIds?: number[] };

/**
 * Tells the user how many of their tasks were paused automatically because
 * only one task can be in progress at a time.
 */
export function notifyAutoPaused(pausedTaskIds: number[] | undefined) {
  const count = pausedTaskIds?.length ?? 0;
  if (count === 0) return;
  toast.info(
    count === 1
      ? "Se pausó automáticamente 1 tarea que estaba en progreso"
      : `Se pausaron automáticamente ${count} tareas que estaban en progreso`
  );
}

interface TaskPauseResumeButtonProps {
  task: { id: number; project_id: number; status: ProjectTaskStatus };
  onChanged: () => void;
}

/**
 * "Pausar" for an in-progress task, "Reanudar" for a paused one; renders
 * nothing for any other status. Callers decide who may see it.
 */
export function TaskPauseResumeButton({ task, onChanged }: TaskPauseResumeButtonProps) {
  const [pending, setPending] = useState(false);

  const action = task.status === "in_progress" ? "pause" : task.status === "paused" ? "resume" : null;
  if (!action) return null;

  const isPause = action === "pause";
  const fallbackError = isPause ? "Error al pausar tarea" : "Error al reanudar tarea";

  const handleClick = async () => {
    setPending(true);
    try {
      const res = await post<StateChangeResponse>(`projects/${task.project_id}/tasks/${task.id}/${action}`, {});
      if (!res.ok) throw new Error(res.error || fallbackError);
      toast.success(res.data?.message ?? (isPause ? "Tarea pausada correctamente" : "Tarea reanudada correctamente"));
      notifyAutoPaused(res.data?.pausedTaskIds);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : fallbackError);
    } finally {
      setPending(false);
    }
  };

  const Icon = pending ? Loader2 : isPause ? PauseCircle : PlayCircle;

  return (
    <Button
      size="sm"
      variant={isPause ? "outline" : "secondary"}
      className="h-7 text-xs gap-1"
      onClick={handleClick}
      disabled={pending}
    >
      <Icon className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
      {isPause ? "Pausar" : "Reanudar"}
    </Button>
  );
}
