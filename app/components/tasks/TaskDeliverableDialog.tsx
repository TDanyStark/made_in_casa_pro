"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProjectTaskType } from "@/lib/definitions";
import { formatProgressMinutes } from "@/lib/task-progress";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { Clock, Eye, ExternalLink, FileText, Link as LinkIcon, User } from "lucide-react";

interface TaskDeliverableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ProjectTaskType | null;
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
                <div
                  className="prose prose-sm dark:prose-invert max-w-none max-h-64 overflow-y-auto rounded-md border bg-muted/20 p-4 text-sm"
                  dangerouslySetInnerHTML={{ __html: task.delivery_notes ?? "" }}
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
