"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, TimerReset, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { post } from "@/lib/services/apiService";
import { MyTaskRowPaginated } from "@/lib/definitions";
import { formatProgressMinutes } from "@/lib/task-progress";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TaskDraft = {
  progressPercent: number;
  accumulatedMinutes: number;
  hoursInput: string;
  minutesInput: string;
  saving: boolean;
};

interface TaskProgressReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: MyTaskRowPaginated[];
  initialTaskId?: number | null;
  reportedTaskIds: number[];
  onTaskReported: (task: MyTaskRowPaginated) => void;
  onTaskViewed?: (taskId: number) => void;
}

function createDraft(task: MyTaskRowPaginated): TaskDraft {
  return {
    progressPercent: task.progress_percent ?? 0,
    accumulatedMinutes: task.progress_minutes ?? 0,
    hoursInput: "",
    minutesInput: "",
    saving: false,
  };
}

export function TaskProgressReportModal({
  open,
  onOpenChange,
  tasks,
  initialTaskId,
  reportedTaskIds,
  onTaskReported,
  onTaskViewed,
}: TaskProgressReportModalProps) {
  const [drafts, setDrafts] = useState<Record<number, TaskDraft>>({});

  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<number, TaskDraft> = {};
      for (const task of tasks) {
        next[task.id] = prev[task.id]
          ? {
              ...prev[task.id],
              progressPercent: prev[task.id].progressPercent,
              accumulatedMinutes: Math.max(prev[task.id].accumulatedMinutes, task.progress_minutes ?? 0),
            }
          : createDraft(task);
      }
      return next;
    });
  }, [tasks]);

  const orderedTasks = useMemo(() => {
    if (!initialTaskId) return tasks;
    return [...tasks].sort((a, b) => {
      if (a.id === initialTaskId) return -1;
      if (b.id === initialTaskId) return 1;
      return 0;
    });
  }, [initialTaskId, tasks]);

  const updateDraft = (taskId: number, updater: (draft: TaskDraft) => TaskDraft) => {
    setDrafts((prev) => ({
      ...prev,
      [taskId]: updater(prev[taskId] ?? createDraft(tasks.find((task) => task.id === taskId)!)),
    }));
  };

  const handleAddTime = (task: MyTaskRowPaginated) => {
    const draft = drafts[task.id] ?? createDraft(task);
    const hours = Number.parseInt(draft.hoursInput || "0", 10);
    const minutes = Number.parseInt(draft.minutesInput || "0", 10);

    if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || minutes < 0 || minutes > 59) {
      toast.error("Ingresa horas válidas y minutos entre 0 y 59");
      return;
    }

    const additionalMinutes = hours * 60 + minutes;
    if (additionalMinutes <= 0) {
      toast.error("Agrega al menos 1 minuto");
      return;
    }

    updateDraft(task.id, (current) => ({
      ...current,
      accumulatedMinutes: current.accumulatedMinutes + additionalMinutes,
      hoursInput: "",
      minutesInput: "",
    }));
    onTaskViewed?.(task.id);
  };

  const handleSave = async (task: MyTaskRowPaginated) => {
    const draft = drafts[task.id] ?? createDraft(task);
    const additionalMinutes = Math.max(0, draft.accumulatedMinutes - (task.progress_minutes ?? 0));

    updateDraft(task.id, (current) => ({ ...current, saving: true }));
    onTaskViewed?.(task.id);

    try {
      const response = await post<{ task: MyTaskRowPaginated }>(
        `projects/${task.project_id}/tasks/${task.id}/progress`,
        {
          progress_percent: draft.progressPercent,
          additional_minutes: additionalMinutes,
        }
      );

      if (!response.ok || !response.data) {
        throw new Error(response.error || "Error al guardar avance");
      }

      const updatedTask = response.data.task;
      onTaskReported(updatedTask);
      setDrafts((prev) => ({
        ...prev,
        [task.id]: createDraft(updatedTask),
      }));
      toast.success(`Avance guardado para “${task.title}”`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar avance");
      updateDraft(task.id, (current) => ({ ...current, saving: false }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Reporte diario de avance
          </DialogTitle>
          <DialogDescription>
            Actualiza porcentaje y tiempo acumulado de tus tareas en progreso. El tiempo nuevo siempre se suma al ya registrado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {orderedTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No tienes tareas en progreso para reportar ahora mismo.
            </div>
          ) : (
            orderedTasks.map((task) => {
              const draft = drafts[task.id] ?? createDraft(task);
              const reported = reportedTaskIds.includes(task.id);

              return (
                <div
                  key={task.id}
                  className={cn(
                    "space-y-4 rounded-xl border p-4 transition-colors",
                    reported && "border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/20"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.project_title}</p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {reported ? "Reportada en esta sesión" : "Pendiente por reportar"}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                    <div className="space-y-2">
                      <Label htmlFor={`progress-percent-${task.id}`}>Avance (%)</Label>
                      <Input
                        id={`progress-percent-${task.id}`}
                        type="number"
                        min={0}
                        max={100}
                        value={draft.progressPercent}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value);
                          updateDraft(task.id, (current) => ({
                            ...current,
                            progressPercent: Number.isNaN(nextValue)
                              ? 0
                              : Math.min(100, Math.max(0, nextValue)),
                          }));
                          onTaskViewed?.(task.id);
                        }}
                      />
                    </div>

                    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <TimerReset className="h-4 w-4 text-muted-foreground" />
                        Tiempo acumulado
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Actual: {formatProgressMinutes(task.progress_minutes ?? 0)} · Total local: {formatProgressMinutes(draft.accumulatedMinutes)}
                      </p>

                      <div className="flex flex-wrap items-end gap-2">
                        <div className="space-y-1">
                          <Label htmlFor={`task-hours-${task.id}`} className="text-xs">Horas</Label>
                          <Input
                            id={`task-hours-${task.id}`}
                            type="number"
                            min={0}
                            className="w-24"
                            value={draft.hoursInput}
                            onChange={(event) => updateDraft(task.id, (current) => ({ ...current, hoursInput: event.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`task-minutes-${task.id}`} className="text-xs">Minutos</Label>
                          <Input
                            id={`task-minutes-${task.id}`}
                            type="number"
                            min={0}
                            max={59}
                            className="w-24"
                            value={draft.minutesInput}
                            onChange={(event) => updateDraft(task.id, (current) => ({ ...current, minutesInput: event.target.value }))}
                          />
                        </div>
                        <Button type="button" variant="outline" onClick={() => handleAddTime(task)}>
                          + Agregar
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="button" onClick={() => handleSave(task)} disabled={draft.saving}>
                      {draft.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Guardar avance
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
