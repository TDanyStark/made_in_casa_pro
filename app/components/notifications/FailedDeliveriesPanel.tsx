"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/services/apiService";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { NotificationDeliveryDetailType } from "@/lib/queries/notificationDeliveries";

const MAX_RETRY_COUNT = 3;

const EVENT_TYPE_LABELS: Record<string, string> = {
  "task.assigned": "Tarea asignada",
  "task.reassigned": "Tarea reasignada",
  "task.completed": "Tarea completada",
  "quote.requested": "Cotización solicitada",
  "quote.received": "Cotización recibida",
  "quote.accepted": "Cotización aceptada",
  "project.adjustment.created": "Ajuste creado",
  "project.completed": "Proyecto completado",
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateStr));
}

interface RetryResponse {
  ok: boolean;
  retrying: boolean;
  attempt: number;
}

export function FailedDeliveriesPanel() {
  const queryClient = useQueryClient();
  const [retryingIds, setRetryingIds] = useState<Set<number>>(new Set());
  const [retryingAll, setRetryingAll] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["failed-deliveries"],
    queryFn: async () => {
      const res = await get<{ data: NotificationDeliveryDetailType[] }>(
        "notification-deliveries?limit=100"
      );
      if (!res.ok) throw new Error(res.error);
      const all = (res.data as { data: NotificationDeliveryDetailType[] }).data;
      return all.filter((d) => d.status === "failed");
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  const retryMutation = useMutation({
    mutationFn: async (deliveryId: number) => {
      const res = await post<RetryResponse>(
        `notification-deliveries/${deliveryId}/retry`,
        {}
      );
      if (!res.ok) throw new Error(res.error ?? "Error al reintentar");
      return res.data as RetryResponse;
    },
    onMutate: (deliveryId) => {
      setRetryingIds((prev) => new Set(prev).add(deliveryId));
    },
    onSettled: (_, __, deliveryId) => {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(deliveryId);
        return next;
      });
    },
    onSuccess: () => {
      toast.success("Reintento iniciado");
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["failed-deliveries"] });
        queryClient.invalidateQueries({ queryKey: ["email-history"] });
      }, 2000);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      toast.error(msg);
    },
  });

  const retryableDeliveries = (data ?? []).filter(
    (d) => d.retry_count < MAX_RETRY_COUNT
  );

  const handleRetryAll = async () => {
    if (retryableDeliveries.length === 0) return;
    setRetryingAll(true);
    let succeeded = 0;
    let failed = 0;
    for (const delivery of retryableDeliveries) {
      try {
        const res = await post<RetryResponse>(
          `notification-deliveries/${delivery.id}/retry`,
          {}
        );
        if (res.ok) succeeded++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setRetryingAll(false);
    if (succeeded > 0) toast.success(`${succeeded} reintento${succeeded > 1 ? "s" : ""} iniciado${succeeded > 1 ? "s" : ""}`);
    if (failed > 0) toast.error(`${failed} no pudieron reintentarse`);
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["failed-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["email-history"] });
    }, 2000);
  };

  const failedCount = data?.length ?? 0;
  const isBusy = retryingAll || retryMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Emails fallidos
          {failedCount > 0 && (
            <Badge variant="destructive" className="ml-1">
              {failedCount}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Emails que no pudieron enviarse. Máximo {MAX_RETRY_COUNT} reintentos por entrega.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Error al cargar los deliveries fallidos.
          </p>
        ) : failedCount === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
            <span>Sin emails fallidos</span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Action bar */}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                {isFetching ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                {isFetching ? "Actualizando..." : "Actualizar"}
              </Button>

              {retryableDeliveries.length > 1 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleRetryAll}
                  disabled={isBusy}
                >
                  {retryingAll ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {retryingAll
                    ? "Reintentando..."
                    : `Reintentar todos (${retryableDeliveries.length})`}
                </Button>
              )}
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Destinatario</TableHead>
                    <TableHead>Intentos</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="w-[110px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.map((delivery) => {
                    const isRetrying = retryingIds.has(delivery.id);
                    const maxReached = delivery.retry_count >= MAX_RETRY_COUNT;

                    return (
                      <TableRow key={delivery.id}>
                        <TableCell className="text-sm">
                          {EVENT_TYPE_LABELS[delivery.event_type ?? ""] ?? delivery.event_type ?? "—"}
                          {delivery.task_title && (
                            <p className="text-xs text-muted-foreground mt-0.5">{delivery.task_title}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {delivery.project_title ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">{delivery.recipient_email}</TableCell>
                        <TableCell>
                          <Badge
                            variant={maxReached ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {delivery.retry_count}/{MAX_RETRY_COUNT}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-destructive/80 max-w-[200px]">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate block cursor-default">
                                  {delivery.error ?? "—"}
                                </span>
                              </TooltipTrigger>
                              {delivery.error && (
                                <TooltipContent className="max-w-xs whitespace-pre-wrap">
                                  {delivery.error}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(delivery.last_attempt_at ?? delivery.created_at)}
                        </TableCell>
                        <TableCell>
                          {maxReached ? (
                            <span className="text-xs text-muted-foreground">Límite</span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isRetrying || isBusy}
                              onClick={() => retryMutation.mutate(delivery.id)}
                            >
                              {isRetrying ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                              )}
                              {isRetrying ? "..." : "Reintentar"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
