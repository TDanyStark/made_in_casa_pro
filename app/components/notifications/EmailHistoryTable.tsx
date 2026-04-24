"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock, SkipForward } from "lucide-react";
import { NotificationDeliveryDetailType, DeliveryStatus } from "@/lib/queries/notificationDeliveries";

interface Props {
  /** If provided, fetches deliveries for the given project. Otherwise fetches global recent deliveries (admin only). */
  projectId?: number;
  limit?: number;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  "task.assigned": "Tarea asignada",
  "task.completed": "Tarea completada",
  "quote.requested": "Cotización solicitada",
  "quote.received": "Cotización recibida",
  "quote.accepted": "Cotización aceptada",
  "project.adjustment.created": "Ajuste creado",
  "project.completed": "Proyecto completado",
};

function StatusBadge({ status }: { status: DeliveryStatus }) {
  const config: Record<DeliveryStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    sent: {
      label: "Enviado",
      variant: "default",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    pending: {
      label: "Pendiente",
      variant: "secondary",
      icon: <Clock className="h-3 w-3" />,
    },
    failed: {
      label: "Fallido",
      variant: "destructive",
      icon: <XCircle className="h-3 w-3" />,
    },
    skipped: {
      label: "Omitido",
      variant: "outline",
      icon: <SkipForward className="h-3 w-3" />,
    },
  };

  const { label, variant, icon } = config[status] ?? config.pending;

  return (
    <Badge variant={variant} className="flex items-center gap-1 w-fit text-xs">
      {icon}
      {label}
    </Badge>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateStr));
}

function ProviderLabel({ provider }: { provider: string }) {
  const labels: Record<string, string> = {
    gmail: "Gmail",
    smtp: "SMTP",
    resend: "Resend",
  };
  return <span className="text-xs text-muted-foreground">{labels[provider] ?? provider}</span>;
}

export function EmailHistoryTable({ projectId, limit = 50 }: Props) {
  const endpoint = projectId
    ? `projects/${projectId}/notification-deliveries?limit=${limit}`
    : `notification-deliveries?limit=${limit}`;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["email-history", projectId ?? "global", limit],
    queryFn: async () => {
      const res = await get<{ data: NotificationDeliveryDetailType[] }>(endpoint);
      if (!res.ok) throw new Error(res.error);
      return (res.data as { data: NotificationDeliveryDetailType[] }).data;
    },
    staleTime: 1000 * 60,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Error al cargar el historial de emails.
      </p>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No hay emails registrados aún.
      </p>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Evento</TableHead>
            {!projectId && <TableHead>Proyecto</TableHead>}
            <TableHead>Destinatario</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((delivery) => (
            <TableRow key={delivery.id}>
              <TableCell className="text-sm">
                {EVENT_TYPE_LABELS[delivery.event_type ?? ""] ?? delivery.event_type ?? "—"}
                {delivery.task_title && (
                  <p className="text-xs text-muted-foreground mt-0.5">{delivery.task_title}</p>
                )}
              </TableCell>
              {!projectId && (
                <TableCell className="text-sm text-muted-foreground">
                  {delivery.project_title ?? "—"}
                </TableCell>
              )}
              <TableCell className="text-sm">{delivery.recipient_email}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  <StatusBadge status={delivery.status} />
                  {delivery.error && (
                    <p className="text-xs text-destructive/80 max-w-[200px] truncate" title={delivery.error}>
                      {delivery.error}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <ProviderLabel provider={delivery.provider} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(delivery.sent_at ?? delivery.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
