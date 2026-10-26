"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { INVALID_COP_AMOUNT_MESSAGE, parseCopAmount } from "@/lib/utils/cop-amount";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SafeHtml } from "@/components/ui/safe-html";
import { ProjectTaskType } from "@/lib/definitions";
import { formatProgressMinutes } from "@/lib/task-progress";
import { get, patch } from "@/lib/services/apiService";
import type { TaskCost } from "@/lib/queries/taskCost";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { Clock, Eye, ExternalLink, FileText, Link as LinkIcon, Pencil, User, Wallet } from "lucide-react";

interface TaskDeliverableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ProjectTaskType | null;
  /** Shows how much the task cost; only for admin, directivo and financiero. */
  showCost?: boolean;
  /** Lets admin and directivo correct the cost of a completed external task (needs showCost). */
  canEditCost?: boolean;
}

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function describeTaskCost(data: TaskCost) {
  switch (data.source) {
    case "frozen_rate":
    case "current_rate":
      return `Interno · ${formatProgressMinutes(data.minutes)} × ${money.format(data.hourly_rate ?? 0)}/h`;
    case "declared":
      return "Externo · costo declarado";
    case "quote":
      return "Externo · cotización aceptada";
    default:
      return null;
  }
}

const auditDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

function describeCorrection(data: TaskCost) {
  if (!data.updated_at) return null;
  const who = data.updated_by_name ? `Corregido por ${data.updated_by_name}` : "Corregido";
  const original = data.original_cost !== null ? ` · valor declarado ${money.format(data.original_cost)}` : "";
  return `${who} el ${auditDate(data.updated_at)}${original}`;
}

function TaskCostSection({
  projectId,
  taskId,
  canEditCost,
}: {
  projectId: number;
  taskId: number;
  canEditCost: boolean;
}) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const queryKey = ["task-cost", projectId, taskId];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await get<TaskCost>(`projects/${projectId}/tasks/${taskId}/cost`);
      if (!res.ok || !res.data) throw new Error(res.error || "Error al obtener el costo de la tarea");
      return res.data;
    },
  });

  const detail = data ? describeTaskCost(data) : null;
  const correction = data ? describeCorrection(data) : null;
  const canEdit = canEditCost && Boolean(data?.editable);
  const isDraftEmpty = draft.trim() === "";

  const startEditing = () => {
    setDraft(data ? String(data.cost) : "");
    setIsEditing(true);
  };

  const saveCost = async () => {
    const amount = parseCopAmount(draft);
    if (amount === null) return;
    if (amount === undefined) {
      toast.error(INVALID_COP_AMOUNT_MESSAGE);
      return;
    }
    setIsSaving(true);
    try {
      const res = await patch<TaskCost>(`projects/${projectId}/tasks/${taskId}/cost`, {
        completion_cost: amount,
      });
      if (!res.ok || !res.data) throw new Error(res.error || "Error al corregir el costo de la tarea");
      queryClient.setQueryData(queryKey, res.data);
      await queryClient.invalidateQueries({ queryKey: ["project-financials", projectId] });
      toast.success("Costo de la tarea actualizado");
      setIsEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al corregir el costo de la tarea");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-start gap-2 border-t pt-4 text-sm">
      <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1 text-muted-foreground">
          Costo de la tarea
          {canEdit && !isEditing && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-5"
              aria-label="Corregir costo de la tarea"
              onClick={startEditing}
            >
              <Pencil />
            </Button>
          )}
        </span>
        {isEditing ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              saveCost();
            }}
          >
            <Input
              aria-label="Nuevo costo de la tarea"
              inputMode="numeric"
              placeholder="Ej: 250000"
              className="h-7 w-32 text-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
            <Button type="submit" size="xs" disabled={isSaving || isDraftEmpty}>
              Guardar
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => setIsEditing(false)} disabled={isSaving}>
              Cancelar
            </Button>
          </form>
        ) : isLoading ? (
          <span className="text-muted-foreground">Cargando…</span>
        ) : isError || !data ? (
          <span className="text-muted-foreground">No se pudo cargar el costo</span>
        ) : data.source === "none" ? (
          <span className="text-muted-foreground">Sin costo registrado</span>
        ) : (
          <>
            <span className="font-medium">{money.format(data.cost)}</span>
            {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
          </>
        )}
        {correction && <span className="text-xs text-muted-foreground">{correction}</span>}
      </div>
    </div>
  );
}

// Fallback used when the paragraph has no layout (hidden / not measured yet).
const DESCRIPTION_FALLBACK_MAX_CHARS = 160;

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function descriptionLooksLong(text: string) {
  return text.length > DESCRIPTION_FALLBACK_MAX_CHARS || text.split("\n").length > 2;
}

function ClampedDescription({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;

    const measure = () => {
      setOverflowing(
        el.clientHeight > 0 ? el.scrollHeight > el.clientHeight + 1 : descriptionLooksLong(text)
      );
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div className="flex flex-col items-start gap-1">
      <p
        ref={ref}
        data-testid="task-description"
        className={`text-sm text-muted-foreground whitespace-pre-line break-words ${
          expanded ? "" : "line-clamp-2"
        }`}
      >
        {text}
      </p>
      {(overflowing || expanded) && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Ver menos" : "Ver más"}
        </Button>
      )}
    </div>
  );
}

export function TaskDeliverableDialog({
  open,
  onOpenChange,
  task,
  showCost = false,
  canEditCost = false,
}: TaskDeliverableDialogProps) {
  if (!task) return null;

  const description = task.description?.trim() ?? "";
  const isCompleted = task.status === "completed";
  const deliveryUrl = task.delivery_url?.trim() ?? "";
  const hasDeliveryNotes = Boolean(task.delivery_notes?.trim());
  const elapsedMinutes = task.progress_minutes ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 pr-6 text-base leading-snug">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="break-words">{task.title}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">Detalles de la tarea</DialogDescription>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {task.status && <TaskStatusBadge status={task.status} className="text-xs" />}
            {task.assigned_user_name && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {task.assigned_user_name}
              </span>
            )}
          </div>
        </DialogHeader>

        {description ? (
          <ClampedDescription key={task.id} text={description} />
        ) : (
          <p className="text-sm italic text-muted-foreground">Sin descripción</p>
        )}

        {showCost && open && <TaskCostSection projectId={task.project_id} taskId={task.id} canEditCost={canEditCost} />}

        {isCompleted && (
          <div className="flex flex-col gap-3 border-t pt-4">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Tiempo invertido:</span>
              {elapsedMinutes > 0 ? (
                <span className="font-medium">{formatProgressMinutes(elapsedMinutes)}</span>
              ) : (
                <span className="text-muted-foreground">Sin tiempo registrado</span>
              )}
            </div>

            <div className="flex min-w-0 items-center gap-2 text-sm">
              <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              {deliveryUrl && isHttpUrl(deliveryUrl) ? (
                <a
                  href={deliveryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 font-medium text-primary hover:underline"
                >
                  <span className="truncate">{deliveryUrl}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              ) : deliveryUrl ? (
                <span className="truncate">{deliveryUrl}</span>
              ) : (
                <span className="text-muted-foreground">Sin link reportado</span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Notas de entrega
              </p>
              {hasDeliveryNotes ? (
                <SafeHtml
                  className="prose prose-sm dark:prose-invert max-w-none max-h-64 overflow-y-auto rounded-md border bg-muted/20 p-4 text-sm"
                  html={task.delivery_notes}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No se registraron notas de entrega.</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
