"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Eye,
  EyeOff,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Package,
  ShieldCheck,
} from "lucide-react";
import { get } from "@/lib/services/apiService";
import type {
  MyTaskRowPaginated,
  TaskFlag,
  TaskType,
  TaskWorkContext,
  TaskWorkHistoryItem,
} from "@/lib/definitions";
import { formatProgressMinutes } from "@/lib/task-progress";
import { isHttpUrl } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeHtml } from "@/components/ui/safe-html";
import { TaskStatusBadge } from "./TaskStatusBadge";

const TYPE_LABELS: Record<TaskType, string> = {
  execution: "Ejecución",
  validation: "Validación",
};

const FLAG_LABELS: Record<TaskFlag, string> = {
  new: "Nueva",
  correction: "Ajuste",
  adjustment: "Cambio de alcance",
};

const formatDate = (value: string | null | undefined, pattern: string) =>
  value ? format(new Date(value), pattern, { locale: es }) : null;

interface TaskWorkSheetProps {
  task: MyTaskRowPaginated | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Action buttons for the task (take, pause, report, complete...). */
  actions?: ReactNode;
}

/**
 * Right-side work panel for a task in Mis Tareas: brief and notes on the left,
 * time, links and previous tasks on the right (stacked on small screens).
 */
export function TaskWorkSheet({ task, open, onOpenChange, actions }: TaskWorkSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-[880px]"
      >
        {task && <TaskWorkSheetBody task={task} open={open} actions={actions} />}
      </SheetContent>
    </Sheet>
  );
}

function TaskWorkSheetBody({
  task,
  open,
  actions,
}: {
  task: MyTaskRowPaginated;
  open: boolean;
  actions?: ReactNode;
}) {
  const taskType = task.task_type ?? "execution";
  const taskFlag = task.task_flag ?? "new";

  const contextQuery = useQuery({
    queryKey: ["task-work-context", task.id],
    queryFn: async () => {
      const res = await get<TaskWorkContext>(
        `projects/${task.project_id}/tasks/${task.id}/context`
      );
      if (!res.ok) throw new Error(res.error || "Error al cargar el detalle de la tarea");
      return res.data as TaskWorkContext;
    },
    enabled: open,
  });

  const context = contextQuery.data;
  const driveUrl = isHttpUrl(context?.drive_folder_url) ? context?.drive_folder_url : null;
  const breadcrumb = [task.brand_name, task.project_title, task.product_name]
    .filter(Boolean)
    .join(" › ");
  const assignedAt = formatDate(task.assigned_at, "d MMM yyyy, HH:mm");
  const progress = Math.min(Math.max(task.progress_percent ?? 0, 0), 100);

  return (
    <>
      <SheetHeader className="border-b px-6 py-4 pr-12">
        <p className="text-xs text-muted-foreground">{breadcrumb}</p>
        <SheetTitle className="text-xl leading-snug">{task.title}</SheetTitle>
        <SheetDescription className="sr-only">
          Detalle de la tarea para trabajarla sin salir de Mis Tareas
        </SheetDescription>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <TaskStatusBadge status={task.status} />
          <Badge variant="outline" className="text-xs">
            {taskType === "validation" && <ShieldCheck className="mr-1 h-3 w-3" />}
            {TYPE_LABELS[taskType]}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {taskFlag !== "new" ? `${FLAG_LABELS[taskFlag]} · ` : ""}V{task.version_number}
          </Badge>
          {task.area_name && (
            <Badge variant="outline" className="text-xs">
              {task.area_name}
            </Badge>
          )}
        </div>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[minmax(0,1fr)_300px] md:overflow-hidden">
        {/* Left: what to do */}
        <section aria-label="Qué hacer" className="space-y-6 p-6 md:overflow-y-auto">
          <div>
            <SectionTitle>La tarea</SectionTitle>
            <div className="rounded-r-lg border-l-[3px] border-market-purple bg-market-purple/5 px-4 py-3 text-sm leading-relaxed whitespace-pre-line">
              {task.description?.trim() || "Esta tarea no tiene descripción."}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {assignedAt ? `Asignada el ${assignedAt}` : "Sin fecha de asignación"}
              {task.creator_user_name && ` · Proyecto creado por ${task.creator_user_name}`}
            </p>
          </div>

          <div>
            <SectionTitle>Notas del proyecto</SectionTitle>
            {contextQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : context ? (
              <div className="space-y-3">
                {context.project_notes ? (
                  <div className="rounded-lg border p-4 text-sm">
                    <SafeHtml html={context.project_notes} className="prose prose-sm dark:prose-invert max-w-none break-words" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Este proyecto no tiene notas.</p>
                )}
                {context.version_notes && (
                  <div className="rounded-lg border p-4 text-sm">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Notas de la versión V{context.version_number}
                    </p>
                    <SafeHtml html={context.version_notes} className="prose prose-sm dark:prose-invert max-w-none break-words" />
                  </div>
                )}
              </div>
            ) : (
              <ContextError onRetry={() => contextQuery.refetch()} />
            )}
          </div>
        </section>

        {/* Right: context rail */}
        <aside
          aria-label="Contexto"
          className="space-y-5 border-t bg-muted/40 p-5 md:overflow-y-auto md:border-t-0 md:border-l"
        >
          <div className="rounded-lg border bg-card p-4">
            <SectionTitle>Tiempo</SectionTitle>
            <p className="text-2xl font-bold tabular-nums">
              {formatProgressMinutes(task.progress_minutes ?? 0)}
            </p>
            <div
              className="mt-2 h-1.5 rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Avance reportado"
            >
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-xs">
              <span className="text-muted-foreground">Avance reportado</span>
              <span className="font-semibold">{progress}%</span>
            </div>
          </div>

          <nav aria-label="Enlaces de la tarea" className="rounded-lg border bg-card p-1.5">
            {contextQuery.isLoading ? (
              <Skeleton className="m-2 h-9" />
            ) : context && driveUrl ? (
              <RailLink
                href={driveUrl}
                icon={<HardDrive className="h-4 w-4 text-blue-600" />}
                title="Drive"
                subtitle={
                  context.version_number > 1
                    ? `Carpeta versión ${context.version_number}`
                    : "Carpeta del proyecto"
                }
              />
            ) : (
              <div className="flex items-center gap-2.5 px-2.5 py-2 text-sm text-muted-foreground">
                <HardDrive className="h-4 w-4" />
                Sin carpeta de Drive
              </div>
            )}
            <RailLink
              href={`/projects/${task.project_id}`}
              icon={<FolderOpen className="h-4 w-4" />}
              title="Proyecto"
              subtitle="Abre en otra pestaña"
            />
            {isHttpUrl(task.delivery_url) && (
              <RailLink
                href={task.delivery_url}
                icon={<Package className="h-4 w-4 text-emerald-600" />}
                title="Mi entregable"
                subtitle="Entregado al completar"
              />
            )}
          </nav>

          <div>
            <SectionTitle>Antes de ti</SectionTitle>
            {contextQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : context ? (
              context.previous_tasks.length > 0 ? (
                <ol className="space-y-0">
                  {context.previous_tasks.map((item, index) => (
                    <HistoryItem
                      key={item.id}
                      item={item}
                      isLast={index === context.previous_tasks.length - 1}
                    />
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aún no hay tareas completadas en este proyecto.
                </p>
              )
            ) : (
              <ContextError onRetry={() => contextQuery.refetch()} />
            )}
          </div>
        </aside>
      </div>

      {actions && (
        <SheetFooter className="flex-row flex-wrap justify-end gap-2 border-t px-6 py-3">
          {actions}
        </SheetFooter>
      )}
    </>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

function RailLink({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
    </a>
  );
}

function HistoryItem({ item, isLast }: { item: TaskWorkHistoryItem; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `task-history-${item.id}`;
  const completedAt = formatDate(item.completed_at, "d MMM");
  const deliveryUrl = isHttpUrl(item.delivery_url) ? item.delivery_url : null;
  const hasDetail = Boolean(item.delivery_notes || deliveryUrl);

  return (
    <li className="relative pb-4 pl-5">
      <span
        aria-hidden="true"
        className="absolute top-1.5 left-1 h-2 w-2 rounded-full bg-muted-foreground"
      />
      {!isLast && (
        <span aria-hidden="true" className="absolute top-4 bottom-0 left-[7px] w-px bg-border" />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">
            {item.title}
            {item.version_number > 1 && (
              <span className="text-muted-foreground"> · V{item.version_number}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {[item.assigned_user_name, completedAt].filter(Boolean).join(" · ")}
          </p>
        </div>
        {hasDetail && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={
              expanded
                ? `Ocultar notas de ${item.title}`
                : `Ver notas y entregable de ${item.title}`
            }
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
      {hasDetail && expanded && (
        <div id={panelId} className="mt-1.5 space-y-2 rounded-md bg-background p-2.5 text-xs">
          {item.delivery_notes ? (
            <SafeHtml html={item.delivery_notes} className="prose prose-sm dark:prose-invert max-w-none break-words" />
          ) : (
            <p className="text-muted-foreground">Sin notas de entrega.</p>
          )}
          {deliveryUrl && (
            <Button asChild size="sm" variant="outline" className="h-7 gap-1 text-xs">
              <a href={deliveryUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                Abrir entregable
              </a>
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function ContextError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>No se pudo cargar esta información.</p>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}
