"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { get, post } from "@/lib/services/apiService";
import {
  ApiResponseWithPagination,
  BrandType,
  MyTaskRowPaginated,
  ProjectTaskStatus,
  ProjectTaskType,
  TaskFlag,
  TaskType,
  UserRole,
  UserType,
} from "@/lib/definitions";
import { ITEMS_PER_PAGE } from "@/config/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import Pagination from "@/components/pagination/Pagination";
import { TaskValidationDialog } from "./TaskValidationDialog";
import { TaskCompleteDialog } from "./TaskCompleteDialog";
import { TaskHistoryDialog } from "./TaskHistoryDialog";
import { TaskProgressReportModal } from "./TaskProgressReportModal";
import { TaskDeliverableDialog } from "./TaskDeliverableDialog";
import {
  TaskStatusBadge,
  TASK_STATUS_LABELS,
  TASK_STATUS_STYLES,
  TASK_STATUS_DOT,
} from "./TaskStatusBadge";
import {
  AlertTriangle,
  BellRing,
  CalendarIcon,
  CheckCircle,
  Clock,
  ExternalLink,
  Eye,
  History as HistoryIcon,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import { CREATOR_FILTER_ROLES } from "@/lib/role-groups";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  formatProgressMinutes,
  getDailySessionStorageKey,
  isAfterDailyReportTime,
} from "@/lib/task-progress";
import type { DateRange } from "react-day-picker";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: ProjectTaskStatus[] = [
  "not_started",
  "waiting",
  "in_progress",
  "completed",
  "blocked",
];

const DEFAULT_STATUS_OPTIONS: ProjectTaskStatus[] = [
  "not_started",
  "in_progress",
  "blocked",
  "waiting",
];

const STATUS_LABELS = TASK_STATUS_LABELS;

const DEFAULT_STATUS_SET = new Set(DEFAULT_STATUS_OPTIONS);

const hasSameStatuses = (a: ProjectTaskStatus[], b: Set<ProjectTaskStatus>) => {
  if (a.length !== b.size) return false;
  return a.every((value) => b.has(value));
};

// ─── Status/type configs ──────────────────────────────────────────────────────

const TYPE_CONFIG: Record<TaskType, { label: string; className: string }> = {
  execution: {
    label: "Ejecución",
    className:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400",
  },
  validation: {
    label: "Validación",
    className:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400",
  },
};

const FLAG_CONFIG: Record<TaskFlag, { label: string; className: string }> = {
  new: { label: "Nueva", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  correction: {
    label: "Corrección",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  adjustment: {
    label: "Ajuste",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toStartOfDayIso(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function toEndOfDayIso(value: string) {
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}

function parseDateParam(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function toDateParam(value: Date) {
  return format(value, "yyyy-MM-dd");
}

interface MyTasksResponse extends ApiResponseWithPagination<MyTaskRowPaginated[]> {
  dailyReportTime?: string;
}

interface DailyReportSessionState {
  dismissed: boolean;
  viewedTaskIds: number[];
  reportedTaskIds: number[];
}

const DAILY_REPORT_STORAGE_PREFIX = "my-tasks-daily-report";

function createEmptyReportState(): DailyReportSessionState {
  return {
    dismissed: false,
    viewedTaskIds: [],
    reportedTaskIds: [],
  };
}

// ─── Dialog state ─────────────────────────────────────────────────────────────

interface ValidateDialogState {
  open: boolean;
  task: MyTaskRowPaginated | null;
  siblings: MyTaskRowPaginated[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MyTasksClient() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const queryClient = useQueryClient();

  // ─── Dialog state ──────────────────────────────────────────────────────────
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<MyTaskRowPaginated | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [taskForHistory, setTaskForHistory] = useState<MyTaskRowPaginated | null>(null);
  const [deliverableDialogOpen, setDeliverableDialogOpen] = useState(false);
  const [taskForDeliverable, setTaskForDeliverable] = useState<ProjectTaskType | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportInitialTaskId, setReportInitialTaskId] = useState<number | null>(null);
  const [startingTaskId, setStartingTaskId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [reportState, setReportState] = useState<DailyReportSessionState>(createEmptyReportState);
  const [validateDialog, setValidateDialog] = useState<ValidateDialogState>({
    open: false,
    task: null,
    siblings: [],
  });

  // ─── URL state ─────────────────────────────────────────────────────────────
  const page = searchParams.get("page") || "1";
  const brandId = searchParams.get("brandId") || "";
  const creatorUserId = searchParams.get("creatorUserId") || "";
  const assignedFrom = searchParams.get("assignedFrom") || "";
  const assignedTo = searchParams.get("assignedTo") || "";
  const q = searchParams.get("q") || "";
  const reportFlag = searchParams.get("report") === "1";

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput === q) return;
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("page", "1");
      if (searchInput) sp.set("q", searchInput);
      else sp.delete("q");
      replace(`${pathname}?${sp.toString()}`);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchInput, q, replace, pathname, searchParams]);

  const statusParams = searchParams
    .getAll("status")
    .filter((v): v is ProjectTaskStatus =>
      STATUS_OPTIONS.includes(v as ProjectTaskStatus)
    );
  const selectedStatuses =
    statusParams.length > 0
      ? Array.from(new Set(statusParams))
      : DEFAULT_STATUS_OPTIONS;

  // ─── URL helpers ──────────────────────────────────────────────────────────
  const setStatusParams = (sp: URLSearchParams, statuses: ProjectTaskStatus[]) => {
    sp.delete("status");
    if (statuses.length === 0 || hasSameStatuses(statuses, DEFAULT_STATUS_SET)) return;
    statuses.forEach((s) => sp.append("status", s));
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

  // ─── Query string for API call ────────────────────────────────────────────
  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page, limit: ITEMS_PER_PAGE.toString() });
    if (brandId) params.set("brandId", brandId);
    if (creatorUserId) params.set("creatorUserId", creatorUserId);
    if (q) params.set("q", q);
    if (!hasSameStatuses(selectedStatuses, DEFAULT_STATUS_SET)) {
      selectedStatuses.forEach((s) => params.append("status", s));
    }
    if (assignedFrom) params.set("assignedFrom", toStartOfDayIso(assignedFrom));
    if (assignedTo) params.set("assignedTo", toEndOfDayIso(assignedTo));
    return params.toString();
  }, [page, brandId, creatorUserId, q, selectedStatuses, assignedFrom, assignedTo]);

  // ─── Data fetching ────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-tasks", queryString],
    queryFn: async () => {
      const res = await get<MyTasksResponse>(
        `my-tasks?${queryString}`
      );
      if (!res.ok) throw new Error(res.error || "Error al obtener tareas");
      return res.data!;
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  // Brands for filter dropdown
  const { data: brandsData } = useQuery({
    queryKey: ["brands-for-filter"],
    queryFn: async () => {
      const res = await get<ApiResponseWithPagination<BrandType[]>>("brands?limit=500");
      if (!res.ok || !res.data) return [];

      const rows = (res.data as unknown as { data?: Array<BrandType & { brand_name?: string }> })
        .data;

      return (rows || []).map((row) => ({
        id: Number(row.id),
        name: row.name || row.brand_name || "",
      }));
    },
  });
  const brands = (brandsData || []).filter((brand) => brand.id && brand.name);

  // Creator users (roles con alcance operativo)
  const { data: assignableUsers = [] } = useQuery({
    queryKey: ["assignable-users"],
    queryFn: async () => {
      const res = await get<{ data: UserType[] }>("users/assignable");
      return res.ok ? res.data?.data || [] : [];
    },
  });
  const creatorUsers = useMemo(
    () =>
      assignableUsers.filter((u) =>
        CREATOR_FILTER_ROLES.includes(
          Number(u.rol_id) as UserRole
        )
      ),
    [assignableUsers]
  );

  const assignedRangeLabel = useMemo(() => {
    if (assignedFrom && assignedTo) {
      return `${format(parseDateParam(assignedFrom)!, "dd MMM yyyy", {
        locale: es,
      })} - ${format(parseDateParam(assignedTo)!, "dd MMM yyyy", { locale: es })}`;
    }
    if (assignedFrom) {
      return format(parseDateParam(assignedFrom)!, "dd MMM yyyy", { locale: es });
    }
    if (assignedTo) {
      return format(parseDateParam(assignedTo)!, "dd MMM yyyy", { locale: es });
    }
    return "Todas las fechas";
  }, [assignedFrom, assignedTo]);

  const assignedDateRange = useMemo<DateRange | undefined>(() => {
    const from = parseDateParam(assignedFrom);
    const to = parseDateParam(assignedTo);
    if (!from && !to) return undefined;
    return { from, to };
  }, [assignedFrom, assignedTo]);

  const updateAssignedRange = (range: DateRange | undefined) => {
    const nextAssignedFrom = range?.from ? toDateParam(range.from) : null;
    const nextAssignedTo = range?.to ? toDateParam(range.to) : null;

    replace(
      `${pathname}?${createQueryString({
        page: "1",
        assignedFrom: nextAssignedFrom,
        assignedTo: nextAssignedTo,
      })}`
    );
  };

  // ─── Derived data ─────────────────────────────────────────────────────────
  const tasks = data?.data || [];
  const currentPage = data?.currentPage || 1;
  const pageCount = data?.pageCount || 1;
  const total = data?.total || 0;
  const dailyReportTime = data?.dailyReportTime || "18:00";

  const isFiltered =
    selectedStatuses.length !== DEFAULT_STATUS_OPTIONS.length ||
    !!brandId ||
    !!creatorUserId ||
    !!q ||
    !!assignedFrom ||
    !!assignedTo ||
    currentPage > 1;

  const activeTasks = tasks.filter(
    (t) => t.status === "in_progress" || t.status === "not_started"
  );
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const blockedTasks = tasks.filter((t) => t.status === "blocked");
  const waitingTasks = tasks.filter((t) => t.status === "waiting");
  const shouldShowDailyReportBanner =
    inProgressTasks.length > 0 &&
    !reportState.dismissed &&
    isAfterDailyReportTime(dailyReportTime);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storageKey = getDailySessionStorageKey(DAILY_REPORT_STORAGE_PREFIX);
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) {
        setReportState(createEmptyReportState());
        return;
      }

      const parsed = JSON.parse(raw) as Partial<DailyReportSessionState>;
      setReportState({
        dismissed: Boolean(parsed.dismissed),
        viewedTaskIds: Array.isArray(parsed.viewedTaskIds) ? parsed.viewedTaskIds : [],
        reportedTaskIds: Array.isArray(parsed.reportedTaskIds) ? parsed.reportedTaskIds : [],
      });
    } catch {
      setReportState(createEmptyReportState());
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = getDailySessionStorageKey(DAILY_REPORT_STORAGE_PREFIX);
    window.sessionStorage.setItem(storageKey, JSON.stringify(reportState));
  }, [reportState]);

  useEffect(() => {
    if (reportFlag && inProgressTasks.length > 0) {
      setReportDialogOpen(true);
    }
  }, [reportFlag, inProgressTasks.length]);

  // ─── Dialog handlers ──────────────────────────────────────────────────────
  const openCompleteDialog = (task: MyTaskRowPaginated) => {
    setTaskToComplete(task);
    setCompleteDialogOpen(true);
  };

  const openHistoryDialog = (task: MyTaskRowPaginated) => {
    setTaskForHistory(task);
    setHistoryDialogOpen(true);
  };

  const openDeliverableDialog = (task: MyTaskRowPaginated) => {
    setTaskForDeliverable({
      ...(task as unknown as ProjectTaskType),
      delivery_url: task.delivery_url ?? null,
      delivery_notes: task.delivery_notes ?? null,
      progress_minutes: task.progress_minutes ?? 0,
    });
    setDeliverableDialogOpen(true);
  };

  const markTaskViewed = (taskId: number) => {
    setReportState((prev) => ({
      ...prev,
      viewedTaskIds: prev.viewedTaskIds.includes(taskId)
        ? prev.viewedTaskIds
        : [...prev.viewedTaskIds, taskId],
    }));
  };

  const markTaskReported = (task: MyTaskRowPaginated) => {
    setReportState((prev) => ({
      ...prev,
      viewedTaskIds: prev.viewedTaskIds.includes(task.id)
        ? prev.viewedTaskIds
        : [...prev.viewedTaskIds, task.id],
      reportedTaskIds: prev.reportedTaskIds.includes(task.id)
        ? prev.reportedTaskIds
        : [...prev.reportedTaskIds, task.id],
    }));

    queryClient.setQueryData<MyTasksResponse | undefined>(["my-tasks", queryString], (current) => {
      if (!current) return current;
      return {
        ...current,
        data: current.data.map((row) => (row.id === task.id ? task : row)),
      };
    });
    queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
  };

  const openReportFlow = (taskId?: number) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", "1");
    sp.set("report", "1");
    sp.delete("status");
    sp.append("status", "in_progress");
    replace(`${pathname}?${sp.toString()}`);
    setReportInitialTaskId(taskId ?? null);
    setReportDialogOpen(true);
    if (taskId) markTaskViewed(taskId);
  };

  const closeReportFlow = () => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("report");
    replace(`${pathname}?${sp.toString()}`);
    setReportDialogOpen(false);
    setReportInitialTaskId(null);
  };

  const dismissDailyReportBanner = () => {
    setReportState((prev) => ({ ...prev, dismissed: true }));
  };

  const openValidate = async (task: MyTaskRowPaginated) => {
    try {
      const res = await get<MyTaskRowPaginated[]>(`projects/${task.project_id}/tasks`);
      const allTasks = res.ok ? (res.data ?? []) : [];
      const siblings = allTasks
        .filter((t) => t.project_id === task.project_id)
        .sort((a, b) => a.order_index - b.order_index);
      setValidateDialog({ open: true, task, siblings });
    } catch {
      toast.error("Error al cargar las tareas del producto");
    }
  };

  const handleStartTask = async (task: MyTaskRowPaginated) => {
    setStartingTaskId(task.id);
    try {
      const res = await post(`projects/${task.project_id}/tasks/${task.id}/start`, {});
      if (!res.ok) throw new Error(res.error || "Error al iniciar tarea");
      toast.success("Tarea iniciada correctamente");
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al iniciar tarea");
    } finally {
      setStartingTaskId(null);
    }
  };

  // ─── Task card renderer ───────────────────────────────────────────────────
  const renderTask = (task: MyTaskRowPaginated) => {
    const taskType = task.task_type ?? "execution";
    const taskFlag = task.task_flag ?? "new";
    const isValidation = taskType === "validation";
    const isNotStarted = task.status === "not_started";
    const isInProgress = task.status === "in_progress";
    const canAct = isInProgress;
    const isReportedThisSession = reportState.reportedTaskIds.includes(task.id);
    const isViewedThisSession = reportState.viewedTaskIds.includes(task.id);
    const highlightForDailyReport =
      reportFlag &&
      isInProgress &&
      !isReportedThisSession &&
      !isViewedThisSession;

    return (
      <div
        key={task.id}
        className={`rounded-lg border bg-card p-4 space-y-3 ${
          task.status === "blocked" ? "border-destructive/40 bg-destructive/5" : ""
        } ${task.status === "waiting" ? "opacity-60" : ""} ${
          highlightForDailyReport
            ? "border-primary/60 bg-primary/5 shadow-sm"
            : isReportedThisSession
              ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20"
              : ""
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="font-medium text-sm">{task.title}</span>
              <Badge
                variant="outline"
                className={`text-xs ${TYPE_CONFIG[taskType]?.className}`}
              >
                {isValidation && <ShieldCheck className="h-3 w-3 mr-1" />}
                {TYPE_CONFIG[taskType]?.label}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                V{task.version_number}
              </Badge>
              {taskFlag !== "new" && (
                <Badge
                  variant="outline"
                  className={`text-xs ${FLAG_CONFIG[taskFlag]?.className}`}
                >
                  {FLAG_CONFIG[taskFlag]?.label}
                </Badge>
              )}
            </div>
            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Dates section */}
            {(task.assigned_at || task.completed_at) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 mb-1">
                {task.assigned_at && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Asignada:{" "}
                    {format(new Date(task.assigned_at), "d MMM, HH:mm", {
                      locale: es,
                    })}
                  </div>
                )}
                {task.completed_at && (
                  <div className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                    <CheckCircle className="h-3 w-3" />
                    Completada:{" "}
                    {format(new Date(task.completed_at), "d MMM, HH:mm", {
                      locale: es,
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
              {task.project_title && (
                <Link
                  href={`/projects/${task.project_id}`}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  {task.project_title}
                </Link>
              )}
              {task.product_name && <span>· {task.product_name}</span>}
              {task.brand_name && (
                <span className="text-muted-foreground/70">· {task.brand_name}</span>
              )}
            </div>

            {isInProgress && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Avance: {task.progress_percent ?? 0}%</span>
                <span>· Tiempo: {formatProgressMinutes(task.progress_minutes ?? 0)}</span>
                {isReportedThisSession && (
                  <span className="font-medium text-emerald-600">· Reportada hoy</span>
                )}
                {highlightForDailyReport && (
                  <span className="font-medium text-primary">· Pendiente por reportar</span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5">
              {task.status === "completed" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={() => openDeliverableDialog(task)}
                  title="Ver entregable"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => openHistoryDialog(task)}
                title="Ver historial de entregables"
              >
                <HistoryIcon className="h-3.5 w-3.5" />
              </Button>
              <TaskStatusBadge status={task.status} />
            </div>

            {isNotStarted && (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs gap-1"
                onClick={() => handleStartTask(task)}
                disabled={startingTaskId === task.id}
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Tomar tarea
              </Button>
            )}

            {canAct && !isValidation && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => openReportFlow(task.id)}
                >
                  <BellRing className="h-3.5 w-3.5" />
                  Reportar avance
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => openCompleteDialog(task)}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Completar
                </Button>
              </>
            )}

            {canAct && isValidation && (
              <Button
                size="sm"
                className="h-7 text-xs gap-1 bg-purple-600 hover:bg-purple-700"
                onClick={() => openValidate(task)}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Validar
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="space-y-3">
        {/* Row 1: Selects + Clear button */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Select
            value={brandId || "all"}
            onValueChange={(value) =>
              replace(
                `${pathname}?${createQueryString({
                  page: "1",
                  brandId: value === "all" ? null : value,
                })}`
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas las marcas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Marca: todas</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={String(brand.id)}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
              <SelectValue placeholder="Creador del proyecto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Creador: todos</SelectItem>
              {creatorUsers.map((user) => (
                <SelectItem key={user.id} value={String(user.id)}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() =>
              (() => {
                const sp = new URLSearchParams(searchParams.toString());
                sp.delete("page");
                sp.delete("brandId");
                sp.delete("creatorUserId");
                sp.delete("assignedFrom");
                sp.delete("assignedTo");
                sp.delete("q");
                sp.delete("status");
                replace(`${pathname}?${sp.toString()}`);
              })()
            }
          >
            Limpiar filtros
          </Button>
        </div>

        {/* Row 2: Status filter pills */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-medium">Estado</p>
            <span className="text-xs text-muted-foreground">
              Doble clic en un estado para seleccionar solo ese y deseleccionar los demás
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(() => {
              const allSelected =
                selectedStatuses.length === STATUS_OPTIONS.length;
              return (
                <button
                  type="button"
                  onClick={() => {
                    const nextStatuses = allSelected ? [] : [...STATUS_OPTIONS];
                    replace(
                      `${pathname}?${createQueryStringWithStatuses(nextStatuses)}`
                    );
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
            {STATUS_OPTIONS.map((status) => {
              const isChecked = selectedStatuses.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    const nextStatuses = isChecked
                      ? selectedStatuses.filter((s) => s !== status)
                      : Array.from(new Set([...selectedStatuses, status]));
                    replace(
                      `${pathname}?${createQueryStringWithStatuses(nextStatuses)}`
                    );
                  }}
                  onDoubleClick={() => {
                    // Doble clic: aislar este estado (selecciona solo este)
                    replace(
                      `${pathname}?${createQueryStringWithStatuses([status])}`
                    );
                  }}
                  title="Doble clic para seleccionar solo este estado"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    isChecked
                      ? TASK_STATUS_STYLES[status]
                      : "border-border bg-muted/40 text-muted-foreground opacity-50"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full shrink-0 ${
                      isChecked ? TASK_STATUS_DOT[status] : "bg-muted-foreground"
                    }`}
                  />
                  {STATUS_LABELS[status]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Search + date range */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label htmlFor="my-tasks-q">Buscar</Label>
            <Input
              id="my-tasks-q"
              placeholder="Buscar por tarea o proyecto..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Rango de asignación</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="my-tasks-assigned-range"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !assignedDateRange?.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-4 w-4" />
                  <span className="truncate">{assignedRangeLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  selected={assignedDateRange}
                  defaultMonth={assignedDateRange?.from}
                  onSelect={updateAssignedRange}
                  initialFocus
                />
                <div className="border-t p-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      replace(
                        `${pathname}?${createQueryString({
                          page: "1",
                          assignedFrom: null,
                          assignedTo: null,
                        })}`
                      )
                    }
                  >
                    Limpiar rango
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {shouldShowDailyReportBanner && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary">
              <BellRing className="h-4 w-4" />
              Reporta tu avance de hoy
            </p>
            <p className="text-sm text-muted-foreground">
              Ya pasó la hora configurada ({dailyReportTime}) y tienes {inProgressTasks.length} tarea(s) en progreso.
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={dismissDailyReportBanner}>
              Ocultar por hoy
            </Button>
            <Button type="button" onClick={() => openReportFlow()}>
              Abrir reporte diario
            </Button>
          </div>
        </div>
      )}

      {/* Task list */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg border-dashed">
          <AlertTriangle className="h-12 w-12 text-destructive/30 mb-3" />
          <p className="text-destructive font-medium">Error al cargar tareas</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg border-dashed">
          <CheckCircle className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">
            No se encontraron tareas
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {isFiltered
              ? "Prueba ajustando los filtros."
              : "Las tareas que se te asignen aparecerán aquí."}
          </p>
        </div>
      ) : isFiltered ? (
        // Flat list when any filter active
        <div className="space-y-3">{tasks.map(renderTask)}</div>
      ) : (
        // Grouped sections when on default view
        <div className="space-y-6">
          {activeTasks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Activas ({activeTasks.length})
              </h2>
              {activeTasks.map(renderTask)}
            </section>
          )}

          {blockedTasks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-destructive uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                Bloqueadas ({blockedTasks.length})
              </h2>
              {blockedTasks.map(renderTask)}
            </section>
          )}

          {waitingTasks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Próximas — esperando turno ({waitingTasks.length})
              </h2>
              {waitingTasks.map(renderTask)}
            </section>
          )}
        </div>
      )}

      {/* Pagination footer */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total} tareas encontradas
        </p>
        {pageCount > 1 && (
          <Pagination
            currentPage={currentPage}
            pageCount={pageCount}
            onPageChange={(nextPage) =>
              replace(
                `${pathname}?${createQueryString({ page: String(nextPage) })}`
              )
            }
          />
        )}
      </div>

      {/* Validate dialog */}
      <TaskValidationDialog
        open={validateDialog.open}
        onOpenChange={(open) => {
          if (!open) setValidateDialog({ open: false, task: null, siblings: [] });
        }}
        task={validateDialog.task as unknown as ProjectTaskType}
        siblings={validateDialog.siblings as unknown as ProjectTaskType[]}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
        }}
      />

      {/* Complete Dialog */}
      <TaskCompleteDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        task={taskToComplete as unknown as ProjectTaskType}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
        }}
      />

      <TaskProgressReportModal
        open={reportDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeReportFlow();
            return;
          }
          setReportDialogOpen(true);
        }}
        tasks={inProgressTasks}
        initialTaskId={reportInitialTaskId}
        reportedTaskIds={reportState.reportedTaskIds}
        onTaskReported={markTaskReported}
        onTaskViewed={markTaskViewed}
      />

      {/* History Dialog */}
      <TaskHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        taskId={taskForHistory?.id ?? null}
        taskTitle={taskForHistory?.title ?? ""}
      />

      {/* Deliverable Dialog */}
      <TaskDeliverableDialog
        open={deliverableDialogOpen}
        onOpenChange={setDeliverableDialogOpen}
        task={taskForDeliverable}
      />
    </div>
  );
}
