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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Pencil, Trash2, Package, X } from "lucide-react";
import ReactSelect from "react-select";

// ─── Status config ────────────────────────────────────────────────────────────

const TASK_STATUS_CONFIG: Record<ProjectTaskStatus, { label: string; className: string }> = {
  not_started: {
    label: "Sin iniciar",
    className: "bg-muted text-muted-foreground",
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
  },
};

// ─── Task form schema ────────────────────────────────────────────────────────

const taskSchema = z.object({
  title: z.string().min(1, "El título es requerido"),
  description: z.string().optional().nullable(),
  area_id: z.coerce.number().positive().optional().nullable(),
  assigned_user_id: z.coerce.number().positive().optional().nullable(),
  status: z.enum(["not_started", "in_progress", "completed", "blocked"]).optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface CollaboratorOption {
  id: number;
  name: string;
}

interface ProductOption {
  value: number;
  label: string;
  categoryName: string | null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  projectId: number;
  /** Initial products from SSR — the component maintains its own live query */
  products: ProjectProductType[];
  canEdit: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectTasksTab({ projectId, products: initialProducts, canEdit }: Props) {
  const queryClient = useQueryClient();

  // Task dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTaskType | null>(null);
  const [activeProductId, setActiveProductId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reordering, setReordering] = useState(false);

  // Product search state (for the "add product" select)
  const [productSearch, setProductSearch] = useState("");
  const [addingProduct, setAddingProduct] = useState(false);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", description: "", area_id: null, assigned_user_id: null },
  });

  // ── Live products query (own source of truth, refreshes after add/remove) ──
  const { data: products = initialProducts, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["project-products", projectId],
    queryFn: async () => {
      const res = await get<ProjectProductType[]>(`projects/${projectId}/products`);
      return res.ok ? (res.data ?? []) : [];
    },
    initialData: initialProducts,
    staleTime: 1000 * 60,
  });

  // ── Tasks query ──────────────────────────────────────────────────────────────
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: async () => {
      const res = await get<ProjectTaskType[]>(`projects/${projectId}/tasks`);
      return res.ok ? (res.data ?? []) : [];
    },
    staleTime: 1000 * 60,
  });

  // ── Areas & collaborators ────────────────────────────────────────────────────
  const { data: areas = [] } = useQuery({
    queryKey: ["areas-all"],
    queryFn: async () => {
      const res = await get<{ data: AreaType[] }>("areas");
      return res.ok ? ((res.data as unknown as { data: AreaType[] })?.data ?? []) : [];
    },
  });

  const selectedAreaId = form.watch("area_id");

  const { data: collaborators = [] } = useQuery<CollaboratorOption[]>({
    queryKey: ["collaborators-by-area", selectedAreaId],
    queryFn: async () => {
      const params = selectedAreaId ? `?area_id=${selectedAreaId}` : "";
      const res = await get<CollaboratorOption[]>(`collaborators${params}`);
      return res.ok ? (res.data ?? []) : [];
    },
    enabled: dialogOpen,
  });

  // ── Product catalog for the "add" select ─────────────────────────────────────
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
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    queryClient.invalidateQueries({ queryKey: ["project-products", projectId] });
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
  };

  // Add product to project
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

  // Remove product (cascade-deletes tasks via DB FK)
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

  // Task handlers
  const getProductTasks = (projectProductId: number) =>
    tasks.filter((t) => t.project_product_id === projectProductId);

  const openCreate = (projectProductId: number) => {
    setActiveProductId(projectProductId);
    setEditingTask(null);
    form.reset({ title: "", description: "", area_id: null, assigned_user_id: null });
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
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: TaskFormValues) => {
    setSubmitting(true);
    try {
      if (editingTask) {
        const res = await patch(`projects/${projectId}/tasks/${editingTask.id}`, {
          ...values,
          area_id: values.area_id ?? null,
          assigned_user_id: values.assigned_user_id ?? null,
        });
        if (!res.ok) throw new Error(res.error);
        toast.success("Tarea actualizada");
      } else {
        const res = await post(`projects/${projectId}/tasks`, {
          ...values,
          project_product_id: activeProductId!,
          area_id: values.area_id ?? null,
          assigned_user_id: values.assigned_user_id ?? null,
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

  const handleStatusChange = async (taskId: number, newStatus: ProjectTaskStatus) => {
    try {
      const res = await patch(`projects/${projectId}/tasks/${taskId}`, { status: newStatus });
      if (!res.ok) throw new Error(res.error);
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    } catch {
      toast.error("Error al actualizar estado");
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
    <>
      {/* ── Products manager section ── */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Productos del proyecto</span>
        </div>

        {/* Current products as dismissible chips */}
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

          {/* Add product inline select */}
          {canEdit && (
            <div className="w-64">
              <ReactSelect<ProductOption>
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
              return (
                <TabsTrigger key={p.id} value={p.id.toString()} className="gap-1.5">
                  {p.product_name}
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
                    renderItem={(task, dragHandle) => (
                      <div className="flex items-start gap-3 rounded-md border bg-card p-3">
                        {canEdit && (
                          <div className="flex-shrink-0 pt-0.5">{dragHandle}</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm leading-snug">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {task.area_name && (
                              <Badge variant="secondary" className="text-xs">
                                {task.area_name}
                              </Badge>
                            )}
                            {task.assigned_user_name && (
                              <Badge variant="outline" className="text-xs">
                                {task.assigned_user_name}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Select
                            value={task.status}
                            onValueChange={(v) =>
                              handleStatusChange(task.id, v as ProjectTaskStatus)
                            }
                          >
                            <SelectTrigger className="h-7 text-xs w-32 border-0 shadow-none">
                              <span
                                className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  TASK_STATUS_CONFIG[task.status]?.className ?? ""
                                }`}
                              >
                                {TASK_STATUS_CONFIG[task.status]?.label ?? task.status}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(TASK_STATUS_CONFIG).map(([val, cfg]) => (
                                <SelectItem key={val} value={val} className="text-xs">
                                  {cfg.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

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
                    )}
                  />
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* ── Create / Edit Task Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]" aria-describedby={undefined}>
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
                      <Input placeholder="Ej: Enviar al equipo creativo" {...field} />
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
                          <SelectItem value="none">Por asignar</SelectItem>
                          {collaborators.map((u) => (
                            <SelectItem key={u.id} value={u.id.toString()}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                            {Object.entries(TASK_STATUS_CONFIG).map(([val, cfg]) => (
                              <SelectItem key={val} value={val}>
                                {cfg.label}
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
    </>
  );
}
