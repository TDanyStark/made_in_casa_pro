"use client";

import { ProjectTaskType, TaskQuoteType } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  Clock, 
  DollarSign, 
  FileText, 
  Send
} from "lucide-react";
import { TaskDeliverableDialog } from "@/components/tasks/TaskDeliverableDialog";
import { useState } from "react";

interface Props {
  tasks: ProjectTaskType[];
  invitedTaskIds: number[];
  submittedQuotes: TaskQuoteType[];
  onQuoteTask: (task: ProjectTaskType) => void;
}

// Inline status config (matching ProjectTasksTab)
const TASK_STATUS_LABELS: Record<string, string> = {
  not_started: "Sin iniciar",
  waiting: "En espera",
  in_progress: "En progreso",
  completed: "Completado",
  blocked: "Bloqueado",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  not_started: "secondary",
  waiting: "secondary",
  in_progress: "default",
  completed: "default",
  blocked: "destructive",
};

export function CollaboratorTasksList({ tasks, invitedTaskIds, submittedQuotes, onQuoteTask }: Props) {
  const [deliverableDialogTask, setDeliverableDialogTask] = useState<ProjectTaskType | null>(null);

  const getQuoteForTask = (taskId: number) => {
    return submittedQuotes.find(q => q.task_id === taskId);
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No hay tareas disponibles para cotizar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => {
        const quote = getQuoteForTask(task.id);
        const isCompleted = task.status === "completed";
        const canQuoteTask = invitedTaskIds.includes(task.id) && !isCompleted;
        const statusLabel = TASK_STATUS_LABELS[task.status] || task.status;
        const statusVariant = STATUS_VARIANT[task.status] || "outline";

        return (
          <Card key={task.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    {task.title}
                    <Badge variant={statusVariant} className="text-xs">
                      {statusLabel}
                    </Badge>
                  </CardTitle>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                </div>
                
                {/* Eye button - only for completed tasks */}
                {isCompleted && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground shrink-0"
                    onClick={() => setDeliverableDialogTask(task)}
                    title="Ver entregable"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-4 text-sm">
                {task.area_name && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="font-medium text-foreground">{task.area_name}</span>
                  </div>
                )}
                
                {task.assigned_user_name && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span>Asignado a:</span>
                    <span className="font-medium text-foreground">{task.assigned_user_name}</span>
                  </div>
                )}
              </div>

              {/* Quote status or action */}
              <div className="mt-4 pt-4 border-t">
                {quote ? (
                  <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="font-semibold">
                          ${quote.price?.toLocaleString("es-CO")}
                        </span>
                      </div>
                      {quote.delivery_minutes && quote.delivery_minutes > 0 && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>
                            {Math.floor(quote.delivery_minutes / 1440) > 0 && `${Math.floor(quote.delivery_minutes / 1440)}d `}
                            {Math.floor((quote.delivery_minutes % 1440) / 60) > 0 && `${Math.floor((quote.delivery_minutes % 1440) / 60)}h `}
                            {quote.delivery_minutes % 60 > 0 && `${quote.delivery_minutes % 60}m`}
                          </span>
                        </div>
                      )}
                      <Badge variant={quote.status === "pending" ? "secondary" : "default"}>
                        {quote.status === "pending" ? "Pendiente" : quote.status}
                      </Badge>
                    </div>
                    {quote.notes && (
                      <span className="text-xs text-muted-foreground">
                        Con notas
                      </span>
                    )}
                  </div>
                ) : isCompleted ? (
                  <div className="text-center py-2 text-muted-foreground text-sm">
                    <CheckCircle className="h-4 w-4 inline mr-1" />
                    Tarea completada - No puedes enviar cotización
                  </div>
                ) : canQuoteTask ? (
                  <Button 
                    onClick={() => onQuoteTask(task)}
                    className="w-full"
                    variant="default"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Cotización
                  </Button>
                ) : (
                  <div className="text-center py-2 text-muted-foreground text-sm">
                    Visible solo como contexto del proyecto
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <TaskDeliverableDialog
        open={!!deliverableDialogTask}
        onOpenChange={(open) => !open && setDeliverableDialogTask(null)}
        task={deliverableDialogTask}
      />
    </div>
  );
}
