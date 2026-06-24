"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Eye, UserPenIcon } from "lucide-react";
import { get, patch } from "@/lib/services/apiService";
import {
  ApiResponseWithPagination,
  ProjectTaskStatus,
  ProjectTaskType,
  TaskCommandCenterRow,
  TaskFlag,
  TaskType,
  UserRole,
  UserType,
  AreaType,
} from "@/lib/definitions";
import { ITEMS_PER_PAGE } from "@/config/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CREATOR_FILTER_ROLES, LEADERSHIP_ROLES } from "@/lib/role-groups";
import { hasAnyRole } from "@/lib/role-groups";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Pagination from "@/components/pagination/Pagination";
import { toast } from "sonner";
import {
  TaskStatusBadge,
  TASK_STATUS_LABELS,
  TASK_STATUS_STYLES,
  TASK_STATUS_DOT,
} from "./TaskStatusBadge";
import { TaskDeliverableDialog } from "./TaskDeliverableDialog";

const STATUS_LABELS = TASK_STATUS_LABELS;
const STATUS_STYLES = TASK_STATUS_STYLES;
const STATUS_DOT = TASK_STATUS_DOT;

const TYPE_LABELS: Record<TaskType, string> = {
  execution: "Ejecución",
  validation: "Validación",
};

const TYPE_STYLES: Record<TaskType, string> = {
  execution:  "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800",
  validation: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-400 dark:border-cyan-800",
};

const FLAG_LABELS: Record<TaskFlag, string> = {
  new: "Nueva",
  correction: "Corrección",
  adjustment: "Ajuste",
};

const FLAG_STYLES: Record<TaskFlag, string> = {
  new:        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
  correction: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800",
  adjustment: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800",
};

const STATUS_OPTIONS: ProjectTaskStatus[] = [
  "not_started",
  "waiting",
  "in_progress",
  "completed",
  "blocked",
];

function toStartOfDayIso(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function toEndOfDayIso(value: string) {
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}

interface TasksCommandCenterClientProps {
  userRole: UserRole;
}

export function TasksCommandCenterClient({ userRole }: TasksCommandCenterClientProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const queryClient = useQueryClient();

  const canEditAssignee = hasAnyRole(userRole, LEADERSHIP_ROLES);

  // State for the inline assignee editor popover
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string>("none");
  const [pendingRequiresQuote, setPendingRequiresQuote] = useState<boolean>(false);

  // State for the deliverable viewer dialog
  const [deliverableTask, setDeliverableTask] = useState<ProjectTaskType | null>(null);
  const [deliverableOpen, setDeliverableOpen] = useState(false);

  function openDeliverableDialog(task: TaskCommandCenterRow) {
    setDeliverableTask({
      ...(task as unknown as ProjectTaskType),
      delivery_url: task.delivery_url ?? null,
      delivery_notes: task.delivery_notes ?? null,
      progress_minutes: task.progress_minutes ?? 0,
    });
    setDeliverableOpen(true);
  }

  const page = searchParams.get("page") || "1";
  const creatorUserId = searchParams.get("creatorUserId") || "";
  const areaId = searchParams.get("areaId") || "";
  const assignedUserId = searchParams.get("assignedUserId") || "";
  const statusParams = searchParams.getAll("status").filter((value): value is ProjectTaskStatus =>
    STATUS_OPTIONS.includes(value as ProjectTaskStatus)
  );
  const selectedStatuses = statusParams.length > 0 ? Array.from(new Set(statusParams)) : STATUS_OPTIONS;
  const taskType = searchParams.get("taskType") || "";
  const taskFlag = searchParams.get("taskFlag") || "";
  const assignedFrom = searchParams.get("assignedFrom") || "";
  const assignedTo = searchParams.get("assignedTo") || "";
  const completedFrom = searchParams.get("completedFrom") || "";
  const completedTo = searchParams.get("completedTo") || "";

  const setStatusParams = (sp: URLSearchParams, statuses: ProjectTaskStatus[]) => {
    sp.delete("status");
    if (statuses.length === 0 || statuses.length === STATUS_OPTIONS.length) return;
    statuses.forEach((taskStatus) => sp.append("status", taskStatus));
  };

  const createQueryString = (params: Record<string, string | null>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === "") sp.delete(key);
      else sp.set(key, value);
    });
    return sp.toString();
  };

  const createQueryStringWithStatuses = (statuses: ProjectTaskStatus[]) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", "1");
    setStatusParams(sp, statuses);
    return sp.toString();
  };

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page, limit: ITEMS_PER_PAGE.toString() });
    if (creatorUserId) params.set("creatorUserId", creatorUserId);
    if (areaId) params.set("areaId", areaId);
    if (assignedUserId) params.set("assignedUserId", assignedUserId);
    if (selectedStatuses.length > 0 && selectedStatuses.length < STATUS_OPTIONS.length) {
      selectedStatuses.forEach((taskStatus) => params.append("status", taskStatus));
    }
    if (taskType) params.set("taskType", taskType);
    if (taskFlag) params.set("taskFlag", taskFlag);
    if (assignedFrom) params.set("assignedFrom", toStartOfDayIso(assignedFrom));
    if (assignedTo) params.set("assignedTo", toEndOfDayIso(assignedTo));
    if (completedFrom) params.set("completedFrom", toStartOfDayIso(completedFrom));
    if (completedTo) params.set("completedTo", toEndOfDayIso(completedTo));
    return params.toString();
  }, [
    page,
    creatorUserId,
    areaId,
    assignedUserId,
    selectedStatuses,
    taskType,
    taskFlag,
    assignedFrom,
    assignedTo,
    completedFrom,
    completedTo,
  ]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["tasks-command-center", queryString],
    queryFn: async () => {
      const res = await get<ApiResponseWithPagination<TaskCommandCenterRow[]>>(`tasks?${queryString}`);
      if (!res.ok) throw new Error(res.error || "Error al obtener tareas");
      return res.data!;
    },
    // Mantener la vista al día: refrescar al visitar la vista y al enfocar la ventana
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const { data: areas = [] } = useQuery({
    queryKey: ["areas-with-internals"],
    queryFn: async () => {
      const res = await get<{ data: AreaType[] }>("areas?with_active_internals=1");
      return res.ok ? res.data?.data || [] : [];
    },
  });

  const { data: assignableUsers = [] } = useQuery({
    queryKey: ["assignable-users"],
    queryFn: async () => {
      const res = await get<{ data: UserType[] }>("users/assignable");
      return res.ok ? res.data?.data || [] : [];
    },
  });

  const creatorUsers = useMemo(
    () =>
        assignableUsers.filter((user) => CREATOR_FILTER_ROLES.includes(user.rol_id)),
    [assignableUsers]
  );

  const updateAssigneeMutation = useMutation({
    mutationFn: async ({
      task,
      newUserId,
      requiresQuote,
    }: {
      task: TaskCommandCenterRow;
      newUserId: string;
      requiresQuote: boolean;
    }) => {
      const body: Record<string, unknown> = {
        requires_quote: requiresQuote ? 1 : 0,
        assigned_user_id: newUserId === "none" ? null : Number(newUserId),
      };
      const res = await patch(`projects/${task.project_id}/tasks/${task.id}`, body);
      if (!res.ok) throw new Error(res.error || "Error al actualizar");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks-command-center"] });
      setEditingTaskId(null);
      toast.success("Tarea actualizada");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al actualizar la tarea");
    },
  });

  const rows = data?.data || [];
  const currentPage = data?.currentPage || 1;
  const pageCount = data?.pageCount || 1;
  const total = data?.total || 0;

  function openEditPopover(task: TaskCommandCenterRow) {
    setEditingTaskId(task.id);
    setPendingUserId(task.assigned_user_id ? String(task.assigned_user_id) : "none");
    setPendingRequiresQuote(Number(task.requires_quote) === 1);
  }

  const selectedTask = rows.find((r) => r.id === editingTaskId) ?? null;
  const pendingUser = pendingUserId !== "none"
    ? assignableUsers.find((u) => String(u.id) === pendingUserId)
    : undefined;
  // is_internal puede llegar como boolean, 0/1 o null según la capa de datos
  const isExternalUser = pendingUser !== undefined && !pendingUser.is_internal;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <SearchableSelect
          value={creatorUserId || "all"}
          onValueChange={(value) =>
            replace(
              `${pathname}?${createQueryString({
                page: "1",
                creatorUserId: value === "all" ? null : value,
              })}`
            )
          }
          options={[
            { value: "all", label: "Usuario creador: todos" },
            ...creatorUsers.map((user) => ({ value: String(user.id), label: user.name })),
          ]}
          placeholder="Usuario creador"
          searchPlaceholder="Buscar usuario..."
          emptyMessage="Sin usuarios."
        />

        <SearchableSelect
          value={areaId || "all"}
          onValueChange={(value) =>
            replace(`${pathname}?${createQueryString({ page: "1", areaId: value === "all" ? null : value })}`)
          }
          options={[
            { value: "all", label: "Área: todas" },
            ...areas.map((area) => ({ value: String(area.id), label: area.name })),
          ]}
          placeholder="Área"
          searchPlaceholder="Buscar área..."
          emptyMessage="Sin áreas."
        />

        <SearchableSelect
          value={assignedUserId || "all"}
          onValueChange={(value) =>
            replace(
              `${pathname}?${createQueryString({ page: "1", assignedUserId: value === "all" ? null : value })}`
            )
          }
          options={[
            { value: "all", label: "Asignado a: todos" },
            ...assignableUsers.map((user) => ({ value: String(user.id), label: user.name })),
          ]}
          placeholder="Asignado a"
          searchPlaceholder="Buscar usuario..."
          emptyMessage="Sin usuarios."
        />

        <Select
          value={taskType || "all"}
          onValueChange={(value) =>
            replace(`${pathname}?${createQueryString({ page: "1", taskType: value === "all" ? null : value })}`)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tipo: todos</SelectItem>
            <SelectItem value="execution">Ejecución</SelectItem>
            <SelectItem value="validation">Validación</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={taskFlag || "all"}
          onValueChange={(value) =>
            replace(`${pathname}?${createQueryString({ page: "1", taskFlag: value === "all" ? null : value })}`)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Bandera" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Bandera: todas</SelectItem>
            <SelectItem value="new">Nueva</SelectItem>
            <SelectItem value="correction">Corrección</SelectItem>
            <SelectItem value="adjustment">Ajuste</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={() =>
            replace(
              `${pathname}?${createQueryString({
                page: null,
                creatorUserId: null,
                areaId: null,
                assignedUserId: null,
                taskType: null,
                taskFlag: null,
                assignedFrom: null,
                assignedTo: null,
                completedFrom: null,
                completedTo: null,
              })}`
            )
          }
        >
          Limpiar filtros
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-medium">Estado</p>
          <span className="text-xs text-muted-foreground">
            Doble clic en un estado para seleccionar solo ese y deseleccionar los demás
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(() => {
            const allSelected = selectedStatuses.length === STATUS_OPTIONS.length;
            return (
              <button
                type="button"
                onClick={() => {
                  const nextStatuses = allSelected ? [] : [...STATUS_OPTIONS];
                  replace(`${pathname}?${createQueryStringWithStatuses(nextStatuses)}`);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  allSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/40 text-muted-foreground opacity-50"
                }`}
              >
                Todos
              </button>
            );
          })()}
          {STATUS_OPTIONS.map((taskStatus) => {
            const isChecked = selectedStatuses.includes(taskStatus);
            return (
              <button
                key={taskStatus}
                type="button"
                onClick={() => {
                  const nextStatuses = isChecked
                    ? selectedStatuses.filter((s) => s !== taskStatus)
                    : Array.from(new Set([...selectedStatuses, taskStatus]));
                  replace(`${pathname}?${createQueryStringWithStatuses(nextStatuses)}`);
                }}
                onDoubleClick={() => {
                  // Doble clic: aislar este estado (selecciona solo este)
                  replace(`${pathname}?${createQueryStringWithStatuses([taskStatus])}`);
                }}
                title="Doble clic para seleccionar solo este estado"
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  isChecked
                    ? STATUS_STYLES[taskStatus]
                    : "border-border bg-muted/40 text-muted-foreground opacity-50"
                }`}
              >
                <span className={`size-1.5 rounded-full shrink-0 ${isChecked ? STATUS_DOT[taskStatus] : "bg-muted-foreground"}`} />
                {STATUS_LABELS[taskStatus]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label htmlFor="assignedFrom">Asignada desde</Label>
          <Input
            id="assignedFrom"
            type="date"
            value={assignedFrom}
            onChange={(e) =>
              replace(`${pathname}?${createQueryString({ page: "1", assignedFrom: e.target.value || null })}`)
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="assignedTo">Asignada hasta</Label>
          <Input
            id="assignedTo"
            type="date"
            value={assignedTo}
            onChange={(e) =>
              replace(`${pathname}?${createQueryString({ page: "1", assignedTo: e.target.value || null })}`)
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="completedFrom">Completada desde</Label>
          <Input
            id="completedFrom"
            type="date"
            value={completedFrom}
            onChange={(e) =>
              replace(`${pathname}?${createQueryString({ page: "1", completedFrom: e.target.value || null })}`)
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="completedTo">Completada hasta</Label>
          <Input
            id="completedTo"
            type="date"
            value={completedTo}
            onChange={(e) =>
              replace(`${pathname}?${createQueryString({ page: "1", completedTo: e.target.value || null })}`)
            }
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarea</TableHead>
              <TableHead>Proyecto</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Asignado</TableHead>
              <TableHead>Bandera</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Versión</TableHead>
              <TableHead>Asignada</TableHead>
              <TableHead>Completada</TableHead>
              <TableHead className="text-right">Entregable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-10" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-destructive h-20">
                  Error al cargar tareas.
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground h-20">
                  No se encontraron tareas con los filtros seleccionados.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.title}</TableCell>
                  <TableCell>
                    <Link href={`/projects/${task.project_id}`} className="text-primary hover:underline">
                      {task.project_title}
                    </Link>
                  </TableCell>
                  <TableCell>{task.product_name || "—"}</TableCell>
                  <TableCell>
                    {canEditAssignee ? (
                      <Popover
                        open={editingTaskId === task.id}
                        onOpenChange={(open) => {
                          if (open) openEditPopover(task);
                          else setEditingTaskId(null);
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            className="flex items-center gap-1.5 text-left hover:text-primary transition-colors group"
                            aria-label="Cambiar responsable"
                          >
                            <span className="text-sm">
                              {task.assigned_user_name || "Sin asignar"}
                            </span>
                            <UserPenIcon className="size-3.5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-72 p-4 space-y-4"
                          align="start"
                          onInteractOutside={(e) => e.preventDefault()}
                          onEscapeKeyDown={() => setEditingTaskId(null)}
                        >
                          <p className="text-sm font-medium leading-none">Cambiar responsable</p>
                          <SearchableSelect
                            value={editingTaskId === task.id ? pendingUserId : (task.assigned_user_id ? String(task.assigned_user_id) : "none")}
                            onValueChange={setPendingUserId}
                            options={[
                              { value: "none", label: "Sin asignar" },
                              ...assignableUsers.map((u) => ({
                                value: String(u.id),
                                label: u.name,
                                badge: u.pending_tasks_count ?? null,
                              })),
                            ]}
                            placeholder="Seleccionar usuario"
                            searchPlaceholder="Buscar usuario..."
                            emptyMessage="Sin usuarios."
                          />
                          {isExternalUser && (
                            <div className="flex items-center justify-between gap-2">
                              <Label htmlFor={`requires-quote-${task.id}`} className="text-sm">
                                Requiere cotización
                              </Label>
                              <Switch
                                id={`requires-quote-${task.id}`}
                                checked={pendingRequiresQuote}
                                onCheckedChange={setPendingRequiresQuote}
                              />
                            </div>
                          )}
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              className="flex-1"
                              disabled={updateAssigneeMutation.isPending}
                              onClick={() => {
                                if (!selectedTask) return;
                                updateAssigneeMutation.mutate({
                                  task: selectedTask,
                                  newUserId: pendingUserId,
                                  requiresQuote: isExternalUser ? pendingRequiresQuote : false,
                                });
                              }}
                            >
                              {updateAssigneeMutation.isPending ? "Guardando..." : "Guardar"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingTaskId(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <span className="text-sm">{task.assigned_user_name || "Sin asignar"}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={`border font-medium ${FLAG_STYLES[task.task_flag]}`}>
                      {FLAG_LABELS[task.task_flag]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`border font-medium ${TYPE_STYLES[task.task_type]}`}>
                      {TYPE_LABELS[task.task_type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <TaskStatusBadge status={task.status} />
                  </TableCell>
                  <TableCell>
                    {task.version_number != null ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        v{task.version_number}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {task.assigned_at
                      ? format(new Date(task.assigned_at), "d MMM yyyy, HH:mm", { locale: es })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {task.completed_at
                      ? format(new Date(task.completed_at), "d MMM yyyy, HH:mm", { locale: es })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {task.status === "completed" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => openDeliverableDialog(task)}
                        title="Ver entregable"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TaskDeliverableDialog
        open={deliverableOpen}
        onOpenChange={setDeliverableOpen}
        task={deliverableTask}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Total: {total} tarea{total !== 1 ? "s" : ""}</p>
        {pageCount > 1 && (
          <Pagination
            currentPage={currentPage}
            pageCount={pageCount}
            onPageChange={(nextPage) =>
              replace(`${pathname}?${createQueryString({ page: String(nextPage) })}`)
            }
          />
        )}
      </div>
    </div>
  );
}
