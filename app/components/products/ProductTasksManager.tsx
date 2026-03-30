"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { SortableList } from "@/components/ui/sortable-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { get, post, patch, del } from "@/lib/services/apiService";
import { ProductTaskTemplateType, TaskType } from "@/lib/definitions";
import { TaskAssignmentSelector, AssignMode } from "@/components/tasks/TaskAssignmentSelector";

// ─── Form schema ──────────────────────────────────────────────────────────────

const taskSchema = z.object({
  title: z.string().min(1, "El título es requerido"),
  description: z.string().optional().nullable(),
  task_type: z.enum(["execution", "validation"]).default("execution"),
  requires_quote: z.boolean().default(false),
  assign_mode: z.enum(["auto", "commercial", "specific"]).default("auto"),
  area_id: z.coerce.number().positive().optional().nullable(),
  assigned_user_id: z.coerce.number().positive().optional().nullable(),
  quoter_ids: z.array(z.number()).default([]),
});

type TaskFormValues = z.infer<typeof taskSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TASK_TYPE_CONFIG: Record<TaskType, { label: string; className: string }> = {
  execution: { label: "Ejecución", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  validation: { label: "Validación", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
};

function deriveAssignMode(task: ProductTaskTemplateType): AssignMode {
  if (task.assign_to_commercial === 1) return "commercial";
  if (task.assigned_user_id !== null) return "specific";
  return "auto";
}

function rolLabel(rolId: number | null): string | null {
  if (rolId === 1) return "Admin";
  if (rolId === 2) return "Directivo";
  if (rolId === 3) return "Comercial";
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  productId: number;
  initialTasks?: ProductTaskTemplateType[];
}

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

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "", description: "", task_type: "execution", requires_quote: false,
      assign_mode: "auto", area_id: null, assigned_user_id: null,
    },
  });

  const selectedTaskType = form.watch("task_type");
  const requiresQuote = form.watch("requires_quote");
  const assignMode = form.watch("assign_mode");
  const areaId = form.watch("area_id");
  const quoterIds = form.watch("quoter_ids");

  // Reset quote fields when switching to validation (validation tasks are internal only)
  useEffect(() => {
    if (selectedTaskType === "validation") {
      form.setValue("requires_quote", false);
      form.setValue("quoter_ids", []);
    }
  }, [selectedTaskType, form]);

  function openCreate() {
    setEditingTask(null);
    form.reset({ title: "", description: "", task_type: "execution", requires_quote: false, assign_mode: "auto", area_id: null, assigned_user_id: null, quoter_ids: [] });
    setDialogOpen(true);
  }

  function openEdit(task: ProductTaskTemplateType) {
    setEditingTask(task);
    form.reset({
      title: task.title, description: task.description ?? "",
      task_type: task.task_type ?? "execution", requires_quote: task.requires_quote === 1,
      assign_mode: deriveAssignMode(task), area_id: task.area_id ?? null,
      assigned_user_id: task.assigned_user_id ?? null,
      quoter_ids: task.quoters?.map((q) => q.user_id) ?? [],
    });
    setDialogOpen(true);
  }

  const onSubmit = async (values: TaskFormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        title: values.title,
        description: values.description ?? null,
        task_type: values.task_type,
        requires_quote: values.requires_quote ? 1 : 0,
        assign_to_commercial: values.assign_mode === "commercial" ? 1 : 0,
        area_id: values.assign_mode !== "commercial" ? (values.area_id ?? null) : null,
        assigned_user_id: values.assign_mode === "specific" ? (values.assigned_user_id ?? null) : null,
        quoter_ids: values.requires_quote ? (values.quoter_ids ?? []) : [],
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
    } catch { toast.error("Error al guardar la tarea"); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (taskId: number) => {
    try {
      const res = await del(`products/${productId}/tasks/${taskId}`);
      if (!res.ok) throw new Error(res.error);
      toast.success("Tarea eliminada");
      refetch();
    } catch { toast.error("Error al eliminar la tarea"); }
  };

  const handleReorder = async (reordered: ProductTaskTemplateType[]) => {
    setReordering(true);
    queryClient.setQueryData(["product-tasks", productId], reordered);
    try {
      const res = await post(`products/${productId}/tasks/reorder`, { orderedIds: reordered.map((t) => t.id) });
      if (!res.ok) throw new Error(res.error);
    } catch {
      toast.error("Error al reordenar las tareas");
      refetch();
    } finally { setReordering(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Tareas predefinidas
          {reordering && <Loader2 className="inline ml-2 h-4 w-4 animate-spin text-muted-foreground" />}
        </h3>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Agregar tarea
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
                  <Badge variant="secondary" className={`text-xs ${TASK_TYPE_CONFIG[task.task_type ?? "execution"]?.className}`}>
                    {TASK_TYPE_CONFIG[task.task_type ?? "execution"]?.label}
                  </Badge>
                  {task.requires_quote === 1 && (
                    <Badge variant="outline" className="text-xs text-amber-700 border-amber-400 bg-amber-50 dark:bg-amber-900/20">
                      Cotización requerida
                      {task.quoters && task.quoters.length > 0 && (
                        <span className="ml-1">· {task.quoters.length} externo(s)</span>
                      )}
                    </Badge>
                  )}
                  {task.assign_to_commercial === 1 && (
                    <Badge variant="outline" className="text-xs text-blue-700 border-blue-300 bg-blue-50 dark:bg-blue-900/20">
                      Comercial del proyecto
                    </Badge>
                  )}
                </div>
                {task.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {task.area_name && <Badge variant="secondary" className="text-xs">{task.area_name}</Badge>}
                  {task.assigned_user_name ? (
                    <Badge variant="outline" className="text-xs">
                      {task.assigned_user_name}
                      {rolLabel(task.assigned_user_rol_id ?? null) && (
                        <span className="ml-1 text-muted-foreground">({rolLabel(task.assigned_user_rol_id ?? null)})</span>
                      )}
                    </Badge>
                  ) : task.assign_to_commercial === 1 ? null : task.area_name ? (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Auto-asignación</Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(task)} title="Editar">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Eliminar">
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto" tabIndex={undefined} aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingTask ? "Editar tarea" : "Nueva tarea predefinida"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">

              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl><Input placeholder="Ej: Diseñar contenido del email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Detalles de la tarea..." rows={2} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="task_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de tarea</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="execution">
                          <div className="flex flex-col items-start">
                            <span>Ejecución</span>
                            <span className="text-xs text-muted-foreground">El colaborador ejecuta y pasa al siguiente</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="validation">
                          <div className="flex flex-col items-start">
                            <span>Validación</span>
                            <span className="text-xs text-muted-foreground">Puede aprobar o rechazar y enviar a cualquier paso</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {selectedTaskType === "execution" && (
                <FormField control={form.control} name="requires_quote" render={({ field }) => (
                  <FormItem className="flex items-start gap-3 rounded-md border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) {
                            form.setValue("assigned_user_id", null);
                            form.setValue("assign_mode", "auto");
                          } else {
                            form.setValue("quoter_ids", []);
                          }
                        }}
                      />
                    </FormControl>
                    <div className="space-y-0.5 -mt-2">
                      <FormLabel className="text-sm font-medium cursor-pointer">Requiere cotización de externo</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        El flujo se bloqueará hasta que un externo presente su propuesta y sea aceptada.
                      </p>
                    </div>
                  </FormItem>
                )} />
              )}

              {/* Unified assignment widget */}
              <Controller control={form.control} name="assign_mode" render={() => (
                <TaskAssignmentSelector
                  assignMode={assignMode}
                  onAssignModeChange={(mode) => form.setValue("assign_mode", mode)}
                  areaId={areaId ?? null}
                  onAreaIdChange={(id) => form.setValue("area_id", id)}
                  assignedUserId={form.watch("assigned_user_id") ?? null}
                  onAssignedUserIdChange={(id) => form.setValue("assigned_user_id", id)}
                  quoterIds={quoterIds}
                  onQuoterIdsChange={(ids) => form.setValue("quoter_ids", ids)}
                  requiresQuote={requiresQuote}
                />
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
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
