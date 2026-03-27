"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { debounce } from "lodash";
import { toast } from "sonner";
import { get, post, patch, del } from "@/lib/services/apiService";
import {
  ProductType,
  ProjectProductType,
  ProjectTaskType,
  ProjectTaskStatus,
  TaskType,
  TaskFlag,
  AreaType,
  ApiResponseWithPagination,
} from "@/lib/definitions";
import { SortableList } from "@/components/ui/sortable-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Package,
  X,
  Lock,
  CheckCircle,
  ChevronDown,
  AlertTriangle,
  Clock,
  ShieldCheck,
} from "lucide-react";
import ReactSelect from "react-select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Status config ────────────────────────────────────────────────────────────

const TASK_STATUS_CONFIG: Record<ProjectTaskStatus, { label: string; className: string; icon?: React.ReactNode }> = {
  not_started: {
    label: "Sin iniciar",
    className: "bg-muted text-muted-foreground",
  },
  waiting: {
    label: "En espera",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400",
    icon: <Clock className="h-3 w-3" />,
  },
  in_progress: {
    label: "En progreso",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  completed: {
    label: "Completado",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  blocked: {
    label: "Bloqueado",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
};

const TASK_TYPE_CONFIG: Record<TaskType, { label: string; className: string }> = {
  execution: { label: "Ejecución", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400" },
  validation: { label: "Validación", className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400" },
};

const TASK_FLAG_CONFIG: Record<TaskFlag, { label: string; className: string }> = {
  new: { label: "Nueva", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400" },
  correction: { label: "Corrección", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400" },
  adjustment: { label: "Ajuste", className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400" },
};

// ─── Task form schema ────────────────────────────────────────────────────────

const taskSchema = z.object({
  title: z.string().min(1, "El título es requerido"),
  description: z.string().optional().nullable(),
  area_id: z.coerce.number().positive().optional().nullable(),
  assigned_user_id: z.coerce.number().positive().optional().nullable(),
  status: z.enum(["not_started", "waiting", "in_progress", "completed", "blocked"]).optional(),
  task_type: z.enum(["execution", "validation"]).default("execution"),
  requires_quote: z.boolean().default(false),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface CollaboratorOption {
  id: number;
  name: string;
  is_internal: number;
  active_task_count: number;
}

interface ProductOption {
  value: number;
  label: string;
  categoryName: string | null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  projectId: number;
  products: ProjectProductType[];
  canEdit: boolean;
  currentUserId?: number;
  currentUserRole?: number;
}

// ─── Validate dialog ─────────────────────────────────────────────────────────

interface ValidateDialogState {
  open: boolean;
  task: ProjectTaskType | null;
  productTasks: ProjectTaskType[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectTasksTab({
  projectId,
  products: initialProducts,
  canEdit,
  currentUserId,
  currentUserRole,
}: Props) {
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTaskType | null>(null);
  const [activeProductId, setActiveProductId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);
  const [validateDialog, setValidateDialog] = useState<ValidateDialogState>({
    open: false,
    task: null,
    productTasks: [],
  });
  const [validateAction, setValidateAction] = useState<"approve" | "reject">("approve");
  const [validateTarget, setValidateTarget] = useState<string>("");
  const [validateNotes, setValidateNotes] = useState("");
  const [validating, setValidating] = useState(false);

  const [productSearch, setProductSearch] = useState("");
  const [addingProduct, setAddingProduct] = useState(false);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      area_id: null,
      assigned_user_id: null,
      task_type: "execution",
      requires_quote: false,
    },
  });

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: products = initialProducts, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["project-products", projectId],
    queryFn: async () => {
      const res = await get<ProjectProductType[]>(`projects/${projectId}/products`);
      return res.ok ? (res.data ?? []) : [];
    },
    initialData: initialProducts,
    staleTime: 1000 * 60,
  });

  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: async () => {
      const res = await get<ProjectTaskType[]>(`projects/${projectId}/tasks`);
      return res.ok ? (res.data ?? []) : [];
    },
    staleTime: 1000 * 60,
  });

  const { data: areas = [] } = useQuery({
    queryKey: ["areas-all"],
    queryFn: async () => {
      const res = await get<{ data: AreaType[] }>("areas");
      return res.ok ? ((res.data as unknown as { data: AreaType[] })?.data ?? []) : [];
    },
  });

  const selectedAreaId = form.watch("area_id");
  const selectedTaskType = form.watch("task_type");
  const requiresQuote = form.watch("requires_quote");

  const { data: collaborators = [] } = useQuery<CollaboratorOption[]>({
    queryKey: ["collaborators-by-area", selectedAreaId, "include_external"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedAreaId) params.set("area_id", selectedAreaId.toString());
      params.set("include_external", "1");
      const res = await get<CollaboratorOption[]>(`collaborators?${params}`);
      return res.ok ? (res.data ?? []) : [];
    },
    enabled: dialogOpen,
  });

  const currentProductIds = new Set(products.map((p) => p.product_id));

  const { data: catalogOptions = [], isLoading: isLoadingCatalog } = useQuery({
    queryKey: ["products-catalog-search", productSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "30", is_active: "1" });
      if (productSearch) params.set("search", productSearch);
      const res = await get<ApiResponseWithPagination<ProductType[]>>(`products?${params}`);
      if (!res.ok || !res.data) return [];
      return ((res.data as unknown as { data: ProductType[] }).data ?? [])
        .filter((p) => !currentProductIds.has(p.id))
        .map((p): ProductOption => ({
          value: p.id,
          label: p.name,
          categoryName: p.category_name,
        }));
    },
    staleTime: 1000 * 30,
  });

  const debouncedProductSearch = debounce((v: string) => setProductSearch(v), 400);

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    queryClient.invalidateQueries({ queryKey: ["project-products", projectId] });
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
  };

  const getProductTasks = (projectProductId: number) =>
    tasks
      .filter((t) => t.project_product_id === projectProductId)
      .sort((a, b) => a.order_index - b.order_index || a.id - b.id);

  const isMyTask = (task: ProjectTaskType) =>
    currentUserId !== undefined && task.assigned_user_id === currentUserId;

  const isAdmin = currentUserRole === 1 || currentUserRole === 2;

  // ─────────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleAddProduct = async (opt: ProductOption | null) => {
    if (!opt) return;
    setAddingProduct(true);
    try {
      const res = await post(`projects/${projectId}/products`, { product_id: opt.value });
      if (!res.ok) throw new Error(res.error);
      toast.success(`"${opt.label}" agregado al proyecto`);
      invalidateAll();
    } catch {
      toast.error("Error al agregar el producto");
    } finally {
      setAddingProduct(false);
    }
  };

  const handleRemoveProduct = async (projectProductId: number, productName: string) => {
    try {
      const res = await del(`projects/${projectId}/products/${projectProductId}`);
      if (!res.ok) throw new Error(res.error);
      toast.success(`"${productName}" quitado del proyecto`);
      invalidateAll();
    } catch {
      toast.error("Error al quitar el producto");
    }
  };

  const openCreate = (projectProductId: number) => {
    setActiveProductId(projectProductId);
    setEditingTask(null);
    form.reset({
      title: "",
      description: "",
      area_id: null,
      assigned_user_id: null,
      task_type: "execution",
      requires_quote: false,
    });
    setDialogOpen(true);
  };

  const openEdit = (task: ProjectTaskType) => {
    setEditingTask(task);
    setActiveProductId(task.project_product_id);
    form.reset({
      title: task.title,
      description: task.description ?? "",
      area_id: task.area_id ?? null,
      assigned_user_id: task.assigned_user_id ?? null,
      status: task.status,
      task_type: task.task_type ?? "execution",
      requires_quote: task.requires_quote === 1,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: TaskFormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        area_id: values.area_id ?? null,
        assigned_user_id: values.assigned_user_id ?? null,
        requires_quote: values.requires_quote ? 1 : 0,
      };

      if (editingTask) {
        const res = await patch(`projects/${projectId}/tasks/${editingTask.id}`, payload);
        if (!res.ok) throw new Error(res.error);
        toast.success("Tarea actualizada");
      } else {
        const res = await post(`projects/${projectId}/tasks`, {
          ...payload,
          project_product_id: activeProductId!,
        });
        if (!res.ok) throw new Error(res.error);
        toast.success("Tarea creada");
      }
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    } catch {
      toast.error("Error al guardar la tarea");
    } finally {
      setSubmitting(false);
    }
  };

  // Complete execution task
  const handleCompleteTask = async (task: ProjectTaskType) => {
    setCompletingTaskId(task.id);
    try {
      const res = await post(`projects/${projectId}/tasks/${task.id}/complete`, {});
      if (!res.ok) throw new Error(res.error);

      const data = res.data as { blockedReason?: string | null };
      if (data?.blockedReason) {
        toast.warning(data.blockedReason, { duration: 6000 });
      } else {
        toast.success("Tarea completada. Se activó la siguiente tarea.");
      }
      invalidateAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al completar tarea";
      toast.error(msg);
    } finally {
      setCompletingTaskId(null);
    }
  };

  // Open validate dialog
  const openValidateDialog = (task: ProjectTaskType) => {
    const productTasks = getProductTasks(task.project_product_id);
    setValidateDialog({ open: true, task, productTasks });
    setValidateAction("approve");
    setValidateTarget("");
    setValidateNotes("");
  };

  // Submit validation
  const handleValidate = async () => {
    if (!validateDialog.task) return;
    setValidating(true);
    try {
      const body: Record<string, unknown> = {
        action: validateAction,
        notes: validateNotes || null,
      };
      if (validateAction === "reject") {
        if (!validateTarget) {
          toast.error("Selecciona a qué tarea regresar");
          return;
        }
        body.target_order_index = parseInt(validateTarget);
      }

      const res = await post(
        `projects/${projectId}/tasks/${validateDialog.task.id}/validate`,
        body
      );
      if (!res.ok) throw new Error(res.error);

      const data = res.data as { blockedReason?: string | null };
      if (validateAction === "approve") {
        if (data?.blockedReason) {
          toast.warning(data.blockedReason, { duration: 6000 });
        } else {
          toast.success("Validación aprobada. Se activó la siguiente tarea.");
        }
      } else {
        toast.success("Tarea enviada a corrección.");
      }

      setValidateDialog({ open: false, task: null, productTasks: [] });
      invalidateAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al validar";
      toast.error(msg);
    } finally {
      setValidating(false);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      const res = await del(`projects/${projectId}/tasks/${taskId}`);
      if (!res.ok) throw new Error(res.error);
      toast.success("Tarea eliminada");
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    } catch {
      toast.error("Error al eliminar tarea");
    }
  };

  const handleReorder = async (projectProductId: number, reordered: ProjectTaskType[]) => {
    setReordering(true);
    const allOtherTasks = tasks.filter((t) => t.project_product_id !== projectProductId);
    queryClient.setQueryData(["project-tasks", projectId], [...allOtherTasks, ...reordered]);
    try {
      const res = await post(`projects/${projectId}/tasks/reorder`, {
        project_product_id: projectProductId,
        orderedIds: reordered.map((t) => t.id),
      });
      if (!res.ok) throw new Error(res.error);
    } catch {
      toast.error("Error al reordenar");
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    } finally {
      setReordering(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoadingTasks && isLoadingProducts) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <TooltipProvider>
      <>
        {/* ── Products manager section ── */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Productos del proyecto</span>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[32px]">
            {isLoadingProducts ? (
              <Skeleton className="h-7 w-48" />
            ) : products.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Sin productos aún</p>
            ) : (
              products.map((p) => {
                const taskCount = getProductTasks(p.id).length;
                return (
                  <AlertDialog key={p.id}>
                    <div className="flex items-center gap-0 rounded-full border bg-muted/50 pl-3 pr-1 py-1 text-sm">
                      <span className="mr-1 font-medium">{p.product_name}</span>
                      {taskCount > 0 && (
                        <span className="text-xs text-muted-foreground mr-1.5">
                          ({taskCount} tarea{taskCount !== 1 ? "s" : ""})
                        </span>
                      )}
                      {canEdit && (
                        <AlertDialogTrigger asChild>
                          <button
                            className="rounded-full p-0.5 hover:bg-destructive/15 hover:text-destructive transition-colors"
                            title={`Quitar ${p.product_name}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </AlertDialogTrigger>
                      )}
                    </div>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Quitar &quot;{p.product_name}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se quitará este producto del proyecto
                          {taskCount > 0
                            ? ` y se eliminarán sus ${taskCount} tarea${taskCount !== 1 ? "s" : ""} asociada${taskCount !== 1 ? "s" : ""}.`
                            : "."}
                          {" "}Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleRemoveProduct(p.id, p.product_name)}
                        >
                          Quitar producto
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                );
              })
            )}

            {canEdit && (
              <div className="w-64">
                <ReactSelect<ProductOption>
                  instanceId="project-tasks-product-select"
                  options={catalogOptions}
                  value={null}
                  onChange={(opt) => handleAddProduct(opt as ProductOption | null)}
                  onInputChange={(v) => debouncedProductSearch(v)}
                  isLoading={isLoadingCatalog || addingProduct}
                  placeholder="+ Agregar producto..."
                  noOptionsMessage={({ inputValue }) =>
                    inputValue ? "Sin resultados" : "Escribe para buscar"
                  }
                  loadingMessage={() => "Cargando..."}
                  controlShouldRenderValue={false}
                  formatOptionLabel={(opt: ProductOption) => (
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      {opt.categoryName && (
                        <p className="text-xs text-muted-foreground">{opt.categoryName}</p>
                      )}
                    </div>
                  )}
                  classNamePrefix="react-select"
                  filterOption={() => true}
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: "32px",
                      height: "32px",
                      fontSize: "0.875rem",
                    }),
                    valueContainer: (base) => ({ ...base, padding: "0 8px" }),
                    indicatorsContainer: (base) => ({ ...base, height: "32px" }),
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Tasks tabs ── */}
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
            <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">
              Agrega un producto para ver sus tareas.
            </p>
          </div>
        ) : (
          <Tabs defaultValue={products[0]?.id.toString()}>
            <TabsList className="flex-wrap h-auto gap-1 mb-4">
              {products.map((p) => {
                const productTasks = getProductTasks(p.id);
                const completed = productTasks.filter((t) => t.status === "completed").length;
                const total = productTasks.length;
                const hasBlocked = productTasks.some((t) => t.status === "blocked");
                return (
                  <TabsTrigger key={p.id} value={p.id.toString()} className="gap-1.5">
                    {p.product_name}
                    {hasBlocked && (
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                    )}
                    <span className="text-xs opacity-60">{completed}/{total}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {products.map((product) => {
              const productTasks = getProductTasks(product.id);
              return (
                <TabsContent key={product.id} value={product.id.toString()} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {productTasks.filter((t) => t.status === "completed").length} de{" "}
                      {productTasks.length} tareas completadas
                      {reordering && (
                        <Loader2 className="inline ml-2 h-3.5 w-3.5 animate-spin" />
                      )}
                    </p>
                    {canEdit && (
                      <Button size="sm" onClick={() => openCreate(product.id)}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Agregar tarea
                      </Button>
                    )}
                  </div>

                  {productTasks.length === 0 ? (
                    <div className="rounded-md border border-dashed py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        No hay tareas para este producto.
                      </p>
                    </div>
                  ) : (
                    <SortableList
                      items={productTasks}
                      onReorder={(reordered) => handleReorder(product.id, reordered)}
                      renderItem={(task, dragHandle) => {
                        const taskType = task.task_type ?? "execution";
                        const taskFlag = task.task_flag ?? "new";
                        const isWaiting = task.status === "waiting";
                        const isBlocked = task.status === "blocked";
                        const isInProgress = task.status === "in_progress";
                        const isValidation = taskType === "validation";
                        const canComplete = isInProgress && !isValidation && (isMyTask(task) || isAdmin);
                        const canValidate = isInProgress && isValidation && (isMyTask(task) || isAdmin);
                        const needsQuote = task.requires_quote === 1 && isBlocked;

                        return (
                          <div
                            className={`flex items-start gap-3 rounded-md border bg-card p-3 transition-opacity ${
                              isWaiting ? "opacity-60" : ""
                            } ${isBlocked ? "border-destructive/50 bg-destructive/5" : ""}`}
                          >
                            {canEdit && !isWaiting && !isBlocked && (
                              <div className="flex-shrink-0 pt-0.5">{dragHandle}</div>
                            )}
                            {(isWaiting || isBlocked) && (
                              <div className="flex-shrink-0 pt-1 pl-1">
                                {isBlocked ? (
                                  <AlertTriangle className="h-4 w-4 text-destructive" />
                                ) : (
                                  <Lock className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              {/* Title + type/flag badges */}
                              <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                                <p className="font-medium text-sm leading-snug">{task.title}</p>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${TASK_TYPE_CONFIG[taskType]?.className}`}
                                >
                                  {isValidation ? (
                                    <ShieldCheck className="h-3 w-3 mr-1" />
                                  ) : null}
                                  {TASK_TYPE_CONFIG[taskType]?.label}
                                </Badge>
                                {taskFlag !== "new" && (
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${TASK_FLAG_CONFIG[taskFlag]?.className}`}
                                  >
                                    {TASK_FLAG_CONFIG[taskFlag]?.label}
                                  </Badge>
                                )}
                                {task.requires_quote === 1 && (
                                  <Badge variant="outline" className="text-xs text-amber-700 border-amber-400 bg-amber-50 dark:bg-amber-900/20">
                                    Cotización
                                  </Badge>
                                )}
                              </div>

                              {task.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {task.description}
                                </p>
                              )}

                              {/* Blocked reason */}
                              {isBlocked && needsQuote && (
                                <p className="text-xs text-destructive mt-1 font-medium">
                                  Esperando cotización de externo
                                </p>
                              )}
                              {isBlocked && !needsQuote && (
                                <p className="text-xs text-destructive mt-1 font-medium">
                                  Sin colaborador asignado
                                </p>
                              )}

                              {/* Area / user badges */}
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {task.area_name && (
                                  <Badge variant="secondary" className="text-xs">
                                    {task.area_name}
                                  </Badge>
                                )}
                                {task.assigned_user_name && (
                                  <Badge variant="outline" className="text-xs">
                                    {task.assigned_user_name}
                                    {isMyTask(task) && (
                                      <span className="ml-1 text-primary">(tú)</span>
                                    )}
                                  </Badge>
                                )}
                                {!task.assigned_user_name && (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">
                                    Sin asignar
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Right: status + actions */}
                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                              {/* Status badge */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                      TASK_STATUS_CONFIG[task.status]?.className ?? ""
                                    }`}
                                  >
                                    {TASK_STATUS_CONFIG[task.status]?.icon}
                                    {TASK_STATUS_CONFIG[task.status]?.label ?? task.status}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {isWaiting
                                    ? "Esta tarea está asignada pero esperando que termine la anterior"
                                    : TASK_STATUS_CONFIG[task.status]?.label}
                                </TooltipContent>
                              </Tooltip>

                              {/* Complete button for execution tasks */}
                              {canComplete && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => handleCompleteTask(task)}
                                  disabled={completingTaskId === task.id}
                                >
                                  {completingTaskId === task.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle className="h-3.5 w-3.5" />
                                  )}
                                  Completar
                                </Button>
                              )}

                              {/* Validate button for validation tasks */}
                              {canValidate && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-7 text-xs gap-1 bg-purple-600 hover:bg-purple-700"
                                  onClick={() => openValidateDialog(task)}
                                >
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  Validar
                                </Button>
                              )}

                              {canEdit && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => openEdit(task)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Se eliminará &quot;{task.title}&quot;. Esta acción no se puede deshacer.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          onClick={() => handleDeleteTask(task.id)}
                                        >
                                          Eliminar
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      }}
                    />
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        {/* ── Create / Edit Task Dialog ── */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[520px]" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>
                {editingTask ? "Editar tarea" : "Nueva tarea"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Diseñar el contenido del email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (opcional)</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Task type */}
                <FormField
                  control={form.control}
                  name="task_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de tarea</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="execution">Ejecución — el colaborador ejecuta y pasa al siguiente</SelectItem>
                            <SelectItem value="validation">Validación — puede aprobar o rechazar y enviar a cualquier paso</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Requires quote — only for execution */}
                {selectedTaskType === "execution" && (
                  <FormField
                    control={form.control}
                    name="requires_quote"
                    render={({ field }) => (
                      <FormItem className="flex items-start gap-3 rounded-md border p-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (checked) form.setValue("assigned_user_id", null);
                            }}
                          />
                        </FormControl>
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium cursor-pointer">
                            Requiere cotización de externo
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            El flujo se bloqueará aquí hasta que un externo sea invitado a cotizar y la cotización sea aceptada.
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="area_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value?.toString() ?? "none"}
                          onValueChange={(v) => {
                            field.onChange(v === "none" ? null : Number(v));
                            form.setValue("assigned_user_id", null);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sin área" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin área</SelectItem>
                            {areas.map((area) => (
                              <SelectItem key={area.id!} value={area.id!.toString()}>
                                {area.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!requiresQuote && (
                  <FormField
                    control={form.control}
                    name="assigned_user_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asignado a</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value?.toString() ?? "none"}
                            onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                            disabled={!selectedAreaId}
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  selectedAreaId ? "Seleccionar persona" : "Selecciona área primero"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                {selectedAreaId ? "Auto-asignación (interno con menos carga)" : "Por asignar"}
                              </SelectItem>
                              {collaborators.map((u) => (
                                <SelectItem key={u.id} value={u.id.toString()}>
                                  {u.name}
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    {u.is_internal ? `• ${u.active_task_count} tarea(s)` : "• Externo"}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {editingTask && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value ?? "not_started"}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(TASK_STATUS_CONFIG) as ProjectTaskStatus[]).map((val) => (
                                <SelectItem key={val} value={val}>
                                  {TASK_STATUS_CONFIG[val].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting} className="gap-2">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editingTask ? "Guardar cambios" : "Agregar tarea"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* ── Validate Dialog ── */}
        <Dialog
          open={validateDialog.open}
          onOpenChange={(open) => {
            if (!open) setValidateDialog({ open: false, task: null, productTasks: [] });
          }}
        >
          <DialogContent className="sm:max-w-[480px]" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-purple-600" />
                Validar tarea
              </DialogTitle>
            </DialogHeader>
            {validateDialog.task && (
              <div className="space-y-4 mt-2">
                <p className="text-sm text-muted-foreground">
                  Tarea: <span className="font-medium text-foreground">{validateDialog.task.title}</span>
                </p>

                {/* Action selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Acción</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setValidateAction("approve")}
                      className={`rounded-md border p-3 text-sm font-medium transition-colors ${
                        validateAction === "approve"
                          ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                          : "border-input hover:bg-muted"
                      }`}
                    >
                      <CheckCircle className="h-4 w-4 mx-auto mb-1" />
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => setValidateAction("reject")}
                      className={`rounded-md border p-3 text-sm font-medium transition-colors ${
                        validateAction === "reject"
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : "border-input hover:bg-muted"
                      }`}
                    >
                      <ChevronDown className="h-4 w-4 mx-auto mb-1" />
                      Rechazar
                    </button>
                  </div>
                </div>

                {/* Target selector for reject */}
                {validateAction === "reject" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Regresar al paso</label>
                    <Select value={validateTarget} onValueChange={setValidateTarget}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tarea destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {validateDialog.productTasks
                          .filter(
                            (t) =>
                              t.id !== validateDialog.task!.id &&
                              t.order_index < validateDialog.task!.order_index
                          )
                          .map((t) => (
                            <SelectItem key={t.id} value={t.order_index.toString()}>
                              {t.order_index + 1}. {t.title}
                              {t.assigned_user_name && (
                                <span className="text-muted-foreground ml-1">
                                  — {t.assigned_user_name}
                                </span>
                              )}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Notas {validateAction === "reject" ? "(requeridas)" : "(opcional)"}
                  </label>
                  <Textarea
                    rows={2}
                    placeholder={
                      validateAction === "approve"
                        ? "Comentario opcional..."
                        : "Explica qué debe corregirse..."
                    }
                    value={validateNotes}
                    onChange={(e) => setValidateNotes(e.target.value)}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setValidateDialog({ open: false, task: null, productTasks: [] })}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleValidate}
                disabled={validating || (validateAction === "reject" && !validateTarget)}
                className={`gap-2 ${
                  validateAction === "reject"
                    ? "bg-destructive hover:bg-destructive/90"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {validating && <Loader2 className="h-4 w-4 animate-spin" />}
                {validateAction === "approve" ? "Aprobar" : "Rechazar y enviar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </TooltipProvider>
  );
}
