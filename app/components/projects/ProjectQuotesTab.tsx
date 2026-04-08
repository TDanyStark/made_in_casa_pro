"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { get, post, patch, del } from "@/lib/services/apiService";
import { ProjectTaskType, TaskQuoteType, TaskQuoteInvitationType } from "@/lib/definitions";
import { formatDHM } from "@/lib/utils/time";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

interface CollaboratorOption {
  id: number;
  name: string;
  is_internal: boolean;
  area_name?: string;
}

interface QuoteData {
  quotes: TaskQuoteType[];
  invitations: TaskQuoteInvitationType[];
}

interface Props {
  projectId: number;
  canEdit: boolean;
}

const QUOTE_STATUS_CONFIG = {
  pending: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  accepted: { label: "Aceptada", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rechazada", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

export function ProjectQuotesTab({ projectId, canEdit }: Props) {
  const queryClient = useQueryClient();
  const [inviteDialogTask, setInviteDialogTask] = useState<ProjectTaskType | null>(null);
  const [inviteUserId, setInviteUserId] = useState<string>("");
  const [inviting, setInviting] = useState(false);
  const [processingQuoteId, setProcessingQuoteId] = useState<number | null>(null);

  // All tasks for this project — filtered to those with requires_quote=1 or blocked
  const { data: allTasks = [], isLoading: isLoadingTasks } = useQuery<ProjectTaskType[]>({
    queryKey: ["project-tasks", projectId],
    queryFn: async () => {
      const res = await get<ProjectTaskType[]>(`projects/${projectId}/tasks`);
      return res.ok ? (res.data ?? []) : [];
    },
    staleTime: 1000 * 60,
  });

  const quoteTasks = allTasks.filter(
    (t) => t.requires_quote === 1 || (t.status === "blocked" && Number(t.pending_quote_count ?? 0) > 0)
  );

  // External collaborators for invite select
  const { data: externals = [] } = useQuery<CollaboratorOption[]>({
    queryKey: ["collaborators-external", inviteDialogTask?.area_id],
    queryFn: async () => {
      const params = new URLSearchParams({ only_external: "1" });
      if (inviteDialogTask?.area_id) params.set("area_id", inviteDialogTask.area_id.toString());
      const res = await get<CollaboratorOption[]>(`collaborators?${params}`);
      return res.ok ? (res.data?.map(u => ({ ...u, is_internal: Boolean(u.is_internal) })) ?? []) : [];
    },
    enabled: !!inviteDialogTask,
  });



  const handleInvite = async () => {
    if (!inviteDialogTask || !inviteUserId) return;
    setInviting(true);
    try {
      const res = await post(`projects/${projectId}/tasks/${inviteDialogTask.id}/quotes`, {
        user_id: parseInt(inviteUserId),
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Colaborador invitado a cotizar");
      queryClient.invalidateQueries({ queryKey: ["task-quotes", inviteDialogTask.id] });
      setInviteUserId("");
      setInviteDialogTask(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al invitar");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveInvitation = async (taskId: number, userId: number) => {
    try {
      const res = await del(`projects/${projectId}/tasks/${taskId}/quotes`, {
        user_id: userId,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Invitación eliminada");
      queryClient.invalidateQueries({ queryKey: ["task-quotes", taskId] });
    } catch {
      toast.error("Error al eliminar invitación");
    }
  };

  const handleAcceptQuote = async (taskId: number, quoteId: number) => {
    setProcessingQuoteId(quoteId);
    try {
      const res = await patch(`projects/${projectId}/tasks/${taskId}/quotes/${quoteId}`, {
        action: "accept",
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Cotización aceptada. Tarea activada.");
      queryClient.invalidateQueries({ queryKey: ["task-quotes", taskId] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al aceptar");
    } finally {
      setProcessingQuoteId(null);
    }
  };

  const handleRejectQuote = async (taskId: number, quoteId: number) => {
    setProcessingQuoteId(quoteId);
    try {
      const res = await patch(`projects/${projectId}/tasks/${taskId}/quotes/${quoteId}`, {
        action: "reject",
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Cotización rechazada");
      queryClient.invalidateQueries({ queryKey: ["task-quotes", taskId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al rechazar");
    } finally {
      setProcessingQuoteId(null);
    }
  };

  if (isLoadingTasks) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (quoteTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg border-dashed">
        <CheckCircle className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground font-medium">Sin cotizaciones pendientes</p>
        <p className="text-sm text-muted-foreground mt-1">
          Las tareas que requieran cotización de externos aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {quoteTasks.map((task) => (
        <TaskQuoteCard
          key={task.id}
          task={task}
          projectId={projectId}
          canEdit={canEdit}
          onInvite={() => setInviteDialogTask(task)}
          onAccept={(qid) => handleAcceptQuote(task.id, qid)}
          onReject={(qid) => handleRejectQuote(task.id, qid)}
          onRemoveInvitation={(uid) => handleRemoveInvitation(task.id, uid)}
          processingQuoteId={processingQuoteId}
        />
      ))}

      {/* Invite Dialog */}
      <Dialog open={!!inviteDialogTask} onOpenChange={(open) => !open && setInviteDialogTask(null)}>
        <DialogContent className="sm:max-w-[420px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invitar a cotizar
            </DialogTitle>
          </DialogHeader>
          {inviteDialogTask && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                Tarea: <span className="font-medium text-foreground">{inviteDialogTask.title}</span>
                {inviteDialogTask.area_name && (
                  <span className="ml-1">— Área: {inviteDialogTask.area_name}</span>
                )}
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Colaborador externo</label>
                <Select value={inviteUserId} onValueChange={setInviteUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar externo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {externals.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                        No hay externos disponibles
                      </div>
                    ) : (
                      externals.map((u) => (
                        <SelectItem key={u.id} value={u.id.toString()}>
                          {u.name}
                          {u.area_name && (
                            <span className="text-muted-foreground ml-1.5">— {u.area_name}</span>
                          )}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogTask(null)}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} disabled={!inviteUserId || inviting} className="gap-2">
              {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
              Invitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── TaskQuoteCard ─────────────────────────────────────────────────────────────

interface TaskQuoteCardProps {
  task: ProjectTaskType;
  projectId: number;
  canEdit: boolean;
  onInvite: () => void;
  onAccept: (quoteId: number) => void;
  onReject: (quoteId: number) => void;
  onRemoveInvitation: (userId: number) => void;
  processingQuoteId: number | null;
}

function TaskQuoteCard({
  task,
  projectId,
  canEdit,
  onInvite,
  onAccept,
  onReject,
  onRemoveInvitation,
  processingQuoteId,
}: TaskQuoteCardProps) {
  const { data: quoteData, isLoading } = useQuery<QuoteData>({
    queryKey: ["task-quotes", task.id],
    queryFn: async () => {
      const res = await get<QuoteData>(`projects/${projectId}/tasks/${task.id}/quotes`);
      return res.ok ? (res.data as unknown as QuoteData) : { quotes: [], invitations: [] };
    },
    staleTime: 1000 * 30,
  });

  const quotes = quoteData?.quotes ?? [];
  const invitations = quoteData?.invitations ?? [];
  const pendingQuotes = quotes.filter((q) => q.status === "pending");
  const hasAccepted = quotes.some((q) => q.status === "accepted");

  return (
    <Card className={task.status === "blocked" ? "border-destructive/40" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {task.status === "blocked" && (
                <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              )}
              {task.title}
            </CardTitle>
            <CardDescription className="mt-0.5">
              {task.area_name && <span>Área: {task.area_name} · </span>}
              {invitations.length} invitado(s) · {pendingQuotes.length} propuesta(s) pendiente(s)
              {hasAccepted && " · ✓ Aceptada"}
            </CardDescription>
          </div>
          {canEdit && !hasAccepted && (
            <Button size="sm" variant="outline" onClick={onInvite} className="gap-1 flex-shrink-0">
              <Plus className="h-3.5 w-3.5" />
              Invitar externo
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            {/* Invitations list */}
            {invitations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Invitados
                </p>
                <div className="space-y-1.5">
                  {invitations.map((inv) => {
                    const quote = quotes.find((q) => q.user_id === inv.user_id);
                    return (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{inv.user_name}</span>
                          {inv.quote_status && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${QUOTE_STATUS_CONFIG[inv.quote_status]?.className ?? ""}`}
                            >
                              {QUOTE_STATUS_CONFIG[inv.quote_status]?.label}
                            </Badge>
                          )}
                          {!inv.quote_status && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Sin respuesta
                            </Badge>
                          )}
                        </div>
                        {canEdit && !hasAccepted && !quote && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive">
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Quitar invitación?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se eliminará la invitación de {inv.user_name} para cotizar esta tarea.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground"
                                  onClick={() => onRemoveInvitation(inv.user_id)}
                                >
                                  Quitar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quotes */}
            {quotes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Propuestas recibidas
                </p>
                <div className="space-y-2">
                  {quotes.map((quote) => (
                    <div
                      key={quote.id}
                      className={`rounded-md border p-3 space-y-2 ${
                        quote.status === "accepted" ? "border-green-400 bg-green-50 dark:bg-green-900/10" : ""
                      } ${quote.status === "rejected" ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{quote.user_name}</span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${QUOTE_STATUS_CONFIG[quote.status]?.className}`}
                          >
                            {QUOTE_STATUS_CONFIG[quote.status]?.label}
                          </Badge>
                        </div>
                        {canEdit && quote.status === "pending" && (
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
                              onClick={() => onAccept(quote.id)}
                              disabled={processingQuoteId === quote.id}
                            >
                              {processingQuoteId === quote.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3 w-3" />
                              )}
                              Aceptar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 text-destructive border-destructive/40 hover:bg-destructive/10"
                              onClick={() => onReject(quote.id)}
                              disabled={processingQuoteId === quote.id}
                            >
                              <Trash2 className="h-3 w-3" />
                              Rechazar
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3 text-sm">
                        {quote.price !== null && (
                          <span className="font-semibold">
                            ${Number(quote.price).toLocaleString("es-CO")}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          Tiempo estimado: {formatDHM(quote.delivery_minutes)}
                        </span>
                      </div>

                      {quote.notes && (
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground"
                          dangerouslySetInnerHTML={{ __html: quote.notes }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {invitations.length === 0 && quotes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aún no hay invitaciones. Invita a un colaborador externo para que cotice.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
