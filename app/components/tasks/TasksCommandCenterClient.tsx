"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { get } from "@/lib/services/apiService";
import {
  ApiResponseWithPagination,
  ProjectTaskStatus,
  TaskCommandCenterRow,
  TaskFlag,
  TaskType,
  UserType,
  AreaType,
  UserRole,
} from "@/lib/definitions";
import { ITEMS_PER_PAGE } from "@/config/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import Pagination from "@/components/pagination/Pagination";

const STATUS_LABELS: Record<ProjectTaskStatus, string> = {
  not_started: "Sin iniciar",
  waiting: "En espera",
  in_progress: "En progreso",
  completed: "Completada",
  blocked: "Bloqueada",
};

const TYPE_LABELS: Record<TaskType, string> = {
  execution: "Ejecución",
  validation: "Validación",
};

const FLAG_LABELS: Record<TaskFlag, string> = {
  new: "Nueva",
  correction: "Corrección",
  adjustment: "Ajuste",
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

export function TasksCommandCenterClient() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

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
      assignableUsers.filter((user) =>
        [UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL].includes(user.rol_id)
      ),
    [assignableUsers]
  );

  const rows = data?.data || [];
  const currentPage = data?.currentPage || 1;
  const pageCount = data?.pageCount || 1;
  const total = data?.total || 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Select
          value={creatorUserId || "all"}
          onValueChange={(value) =>
            replace(
              `${pathname}?${createQueryString({
                page: "1",
                creatorUserId: value === "all" ? null : value,
              })}`
            )
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Usuario creador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Usuario creador: todos</SelectItem>
            {creatorUsers.map((user) => (
              <SelectItem key={user.id} value={String(user.id)}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={areaId || "all"}
          onValueChange={(value) =>
            replace(`${pathname}?${createQueryString({ page: "1", areaId: value === "all" ? null : value })}`)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Área: todas</SelectItem>
            {areas.map((area) => (
              <SelectItem key={area.id} value={String(area.id)}>
                {area.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={assignedUserId || "all"}
          onValueChange={(value) =>
            replace(
              `${pathname}?${createQueryString({ page: "1", assignedUserId: value === "all" ? null : value })}`
            )
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Asignado a" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Asignado a: todos</SelectItem>
            {assignableUsers.map((user) => (
              <SelectItem key={user.id} value={String(user.id)}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
        <p className="text-sm font-medium">Estado</p>
        <div className="flex flex-wrap gap-4">
          {STATUS_OPTIONS.map((taskStatus) => {
            const isChecked = selectedStatuses.includes(taskStatus);
            return (
              <div key={taskStatus} className="flex items-center gap-2">
                <Checkbox
                  id={`status-${taskStatus}`}
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    const nextStatuses = checked
                      ? Array.from(new Set([...selectedStatuses, taskStatus]))
                      : selectedStatuses.filter((statusValue) => statusValue !== taskStatus);
                    replace(`${pathname}?${createQueryStringWithStatuses(nextStatuses)}`);
                  }}
                />
                <Label htmlFor={`status-${taskStatus}`}>{STATUS_LABELS[taskStatus]}</Label>
              </div>
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
              <TableHead>Asignada</TableHead>
              <TableHead>Completada</TableHead>
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
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-destructive h-20">
                  Error al cargar tareas.
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground h-20">
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
                  <TableCell>{task.assigned_user_name || "Sin asignar"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{FLAG_LABELS[task.task_flag]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TYPE_LABELS[task.task_type]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{STATUS_LABELS[task.status]}</Badge>
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
