"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import { TaskTransitionType } from "@/lib/definitions";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { History, User, MessageSquare } from "lucide-react";

interface TaskHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: number | null;
  taskTitle: string;
}

export function TaskHistoryDialog({
  open,
  onOpenChange,
  taskId,
  taskTitle,
}: TaskHistoryDialogProps) {
  const { data: transitions = [], isLoading } = useQuery<TaskTransitionType[]>({
    queryKey: ["task-history", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const res = await get<TaskTransitionType[]>(`projects/0/tasks/${taskId}/history`);
      return res.ok ? (res.data ?? []) : [];
    },
    enabled: open && !!taskId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            Historial de Entregables y Cambios
          </DialogTitle>
          <p className="text-sm text-muted-foreground font-medium truncate">
            {taskTitle}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-6 pt-2">
          {isLoading ? (
            <div className="space-y-4 mt-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : transitions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No hay historial registrado para esta tarea.</p>
            </div>
          ) : (
            <div className="h-[50vh] pr-4 mt-4 overflow-y-auto custom-scrollbar">
              <div className="space-y-6 relative before:absolute before:inset-0 before:left-2 before:w-0.5 before:bg-muted before:h-full">
                {transitions.map((transition) => (
                  <div key={transition.id} className="relative pl-8 pb-2">
                    {/* Dot */}
                    <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-background bg-muted flex items-center justify-center">
                       <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                           {transition.to_status === 'completed' ? 'Completada' : 
                            transition.to_status === 'blocked' ? 'Bloqueada' : 
                            transition.to_status === 'in_progress' ? 'En progreso' : 
                            transition.to_status === 'not_started' ? 'Sin iniciar' : transition.to_status}
                        </span>
                        <time className="text-[10px] text-muted-foreground">
                          {format(new Date(transition.transitioned_at), "d 'de' MMMM, HH:mm", { locale: es })}
                        </time>
                      </div>

                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {transition.moved_by_name || "Sistema"}
                      </div>

                      {transition.notes && (
                        <div className="mt-2 bg-muted/40 rounded-md p-3 border border-dashed border-muted-foreground/20">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-3 w-3 mt-1 text-primary/60 shrink-0" />
                            <div 
                              className="text-xs text-foreground/80 leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                              dangerouslySetInnerHTML={{ __html: transition.notes }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
