"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { SortableList } from "@/components/ui/sortable-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { get, post, patch, del } from "@/lib/services/apiService";
import { AreaType, ProductTaskTemplateType, TaskType } from "@/lib/definitions";

const taskSchema = z.object({
  title: z.string().min(1, "El título es requerido"),
  description: z.string().optional().nullable(),
  area_id: z.coerce.number().positive().optional().nullable(),
  assigned_user_id: z.coerce.number().positive().optional().nullable(),
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

interface Props {
  productId: number;
  initialTasks?: ProductTaskTemplateType[];
}

const TASK_TYPE_CONFIG: Record<TaskType, { label: string; className: string }> = {
  execution: { label: "Ejecución", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  validation: { label: "Validación", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
};

export default function ProductTasksManager({ productId, initialTasks = [] }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProductTaskTemplateType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reordering, setReordering] = useState(false);

  const { data: tasks = initialTasks, refetch } = useQuery({
    queryKey: ["product-tasks", productId],
    queryFn: async () => {
      const res = await get<ProductTaskTemplateType[]>(`products/${productId}/tasks`);
      return res.ok ? (res.data ?? []) : [];
    },
    initialData: initialTasks,
    staleTime: 1000 * 60 * 2,
  });

  const { data: areas = [] } = useQuery({
    queryKey: ["areas-all"],
    queryFn: async () => {
      const res = await get<{ data: AreaType[] }>("areas");
      return res.ok ? ((res.data as unknown as { data: AreaType[] })?.data ?? []) : [];
    },
  });

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

  function openCreate() {
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
  }

  function openEdit(task: ProductTaskTemplateType) {
    setEditingTask(task);
    form.reset({
      title: task.title,
      description: task.description ?? "",
      area_id: task.area_id ?? null,
      assigned_user_id: task.assigned_user_id ?? null,
      task_type: task.task_type ?? "execution",
      requires_quote: task.requires_quote === 1,
    });
    setDialogOpen(true);
  }

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
        const res = await patch(`products/${productId}/tasks/${editingTask.id}`, payload);
        if (!res.ok) throw new Error(res.error);
        toast.success("Tarea actualizada");
      } else {
        const res = await post(`products/${productId}/tasks`, payload);
        if (!res.ok) throw new Error(res.error);
        toast.success("Tarea creada");
      }
      setDialogOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["product-tasks", productId] });
    } catch {
      toast.error("Error al guardar la tarea");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (taskId: number) => {
    try {
      const res = await del(`products/${productId}/tasks/${taskId}`);
      if (!res.ok) throw new Error(res.error);
      toast.success("Tarea eliminada");
      refetch();
    } catch {
      toast.error("Error al eliminar la tarea");
    }
  };

  const handleReorder = async (reordered: ProductTaskTemplateType[]) => {
    setReordering(true);
    queryClient.setQueryData(["product-tasks", productId], reordered);
    try {
      const res = await post(`products/${productId}/tasks/reorder`, {
        orderedIds: reordered.map((t) => t.id),
      });
      if (!res.ok) throw new Error(res.error);
    } catch {
      toast.error("Error al reordenar las tareas");
      refetch();
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Tareas predefinidas
          {reordering && <Loader2 className="inline ml-2 h-4 w-4 animate-spin text-muted-foreground" />}
        </h3>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Agregar tarea
        </Button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
          Este producto no tiene tareas predefinidas. Agrega la primera.
        </p>
      ) : (
        <SortableList
          items={tasks}
          onReorder={handleReorder}
          renderItem={(task, dragHandle) => (
            <div className="flex items-start gap-3 rounded-md border bg-card p-3">
              <div className="flex-shrink-0 pt-0.5">{dragHandle}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <p className="font-medium text-sm leading-snug">{task.title}</p>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${TASK_TYPE_CONFIG[task.task_type ?? "execution"]?.className ?? ""}`}
                  >
                    {TASK_TYPE_CONFIG[task.task_type ?? "execution"]?.label ?? task.task_type}
                  </Badge>
                  {task.requires_quote === 1 && (
                    <Badge variant="outline" className="text-xs text-amber-700 border-amber-400 bg-amber-50 dark:bg-amber-900/20">
                      Cotización requerida
                    </Badge>
                  )}
                </div>
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
                  {task.assigned_user_name ? (
                    <Badge variant="outline" className="text-xs">
                      {task.assigned_user_name}
                    </Badge>
                  ) : task.area_name ? (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Auto-asignación
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => openEdit(task)}
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se eliminará &quot;{task.title}&quot; de las tareas predefinidas. Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => handleDelete(task.id)}
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        />
      )}

      {/* Task Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]" tabIndex={undefined} aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {editingTask ? "Editar tarea" : "Nueva tarea predefinida"}
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
                      <Input placeholder="Ej: Diseñar contenido del email" {...field} />
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
                      <Textarea
                        placeholder="Detalles de la tarea..."
                        rows={2}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Task type selector */}
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
                          <SelectItem value="execution">
                            <div className="flex flex-col">
                              <span>Ejecución</span>
                              <span className="text-xs text-muted-foreground">El colaborador ejecuta y pasa al siguiente</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="validation">
                            <div className="flex flex-col">
                              <span>Validación</span>
                              <span className="text-xs text-muted-foreground">El colaborador puede aprobar o rechazar y enviar a cualquier paso</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Requires quote checkbox — only for execution tasks */}
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
                            if (checked) {
                              // If requires quote, clear specific user (externals quote first)
                              form.setValue("assigned_user_id", null);
                            }
                          }}
                        />
                      </FormControl>
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium cursor-pointer">
                          Requiere cotización de externo
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          El flujo se bloqueará en esta tarea hasta que un colaborador externo presente su propuesta y sea aceptada.
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
                    <FormLabel>Área responsable</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value?.toString() ?? "none"}
                        onValueChange={(v) => {
                          field.onChange(v === "none" ? null : Number(v));
                          form.setValue("assigned_user_id", null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar área (opcional)" />
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
                      <FormLabel>Persona asignada (opcional)</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value?.toString() ?? "none"}
                          onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                          disabled={!selectedAreaId}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                selectedAreaId
                                  ? "Asignar a persona específica"
                                  : "Selecciona un área primero"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              {selectedAreaId ? "Auto-asignación (interno con menos carga)" : "Sin asignar"}
                            </SelectItem>
                            {collaborators.map((u) => (
                              <SelectItem key={u.id} value={u.id.toString()}>
                                <span>{u.name}</span>
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

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting} className="flex gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingTask ? "Guardar cambios" : "Agregar tarea"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
