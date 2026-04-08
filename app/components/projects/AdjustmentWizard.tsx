"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import { ProductTaskTemplateType, UserRole } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Loader2,
  ChevronRight,
  ChevronLeft,
  FileText,
  ListTodo,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  ProjectTaskEditorList,
  TaskSettingsDialog,
  LocalTask,
  UserOption,
  deriveAssignMode,
  resolveAssigneeName,
} from "./shared/ProjectTaskEditor";

const RichTextEditor = dynamic(
  () => import("@/components/clients/RichTextEditor").then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <div className="h-40 w-full animate-pulse bg-muted rounded-md" /> }
);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  productId: number | null;
  createdByName?: string | null;
  userRole: UserRole;
  onConfirm: (data: {
    notes: string;
    tasks: { 
      template_id?: number | null; 
      title: string; 
      description: string;
      assigned_user_id?: number | null; 
      assign_to_commercial?: number; 
      area_id?: number | null; 
      task_type?: string;
      requires_quote?: number;
      quoter_ids?: number[];
    }[];
  }) => Promise<void>;
  isSubmitting: boolean;
}

export function AdjustmentWizard({ 
  open, 
  onOpenChange, 
  projectId, 
  productId, 
  createdByName, 
  onConfirm, 
  isSubmitting 
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [notes, setNotes] = useState("");

  const [localTasks, setLocalTasks] = useState<LocalTask[]>([]);
  const [taskToEdit, setTaskToEdit] = useState<LocalTask | null>(null);
  const nextLocalId = useRef(-1);
  const initialized = useRef(false);

  // Reset when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setNotes("");
      setLocalTasks([]);
      initialized.current = false;
    }
  }, [open]);

  const { data: templates = [], isLoading: loadingTemplates } = useQuery<ProductTaskTemplateType[]>({
    queryKey: ["product-task-templates", productId],
    queryFn: async () => {
      if (!productId) return [];
      const res = await get<ProductTaskTemplateType[]>(`products/${productId}/tasks`);
      return res.ok ? (res.data ?? []) : [];
    },
    enabled: !!productId && open,
    staleTime: 1000 * 60 * 5,
  });

  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ["all-users-for-wizard-tasks"],
    queryFn: async () => {
      const res = await get<UserOption[]>(`collaborators?all_users=1`);
      return res.ok ? (res.data ?? []) : [];
    },
    staleTime: 1000 * 60 * 5,
    enabled: open,
  });

  // Initialize tasks from templates when moving to step 2
  useEffect(() => {
    if (step !== 2 || initialized.current) return;
    if (users.length === 0) return;
    initialized.current = true;

    const rows: LocalTask[] = templates.map(t => {
      let resolvedUserId = t.assigned_user_id;
      if (!resolvedUserId && Number(t.assign_to_commercial) !== 1 && t.area_id) {
        const areaUser = users.find(u => u.area_id === t.area_id && u.rol_id === 4 && u.is_internal === 1);
        resolvedUserId = areaUser?.id ?? null;
      }

      const partialTask = {
        assigned_user_id: resolvedUserId,
        assign_to_commercial: t.assign_to_commercial,
        area_id: t.area_id,
        requires_quote: t.requires_quote === 1,
      };

      const resolvedUserName = resolveAssigneeName(partialTask, users, createdByName);

      return {
        id: t.id,
        template_id: t.id,
        isExtra: false,
        title: t.title,
        description: t.description || "",
        area_id: t.area_id,
        area_name: t.area_name,
        assigned_user_id: resolvedUserId,
        assigned_user_name: resolvedUserName,
        assign_to_commercial: t.assign_to_commercial,
        assign_mode: deriveAssignMode(partialTask),
        requires_quote: t.requires_quote === 1,
        quoter_ids: t.quoters?.map(q => q.user_id) ?? [],
        order_index: t.order_index,
        task_type: t.task_type,
      };
    });

    setLocalTasks(rows.sort((a, b) => a.order_index - b.order_index));
  }, [step, templates, users, createdByName]);

  const updateTask = (taskId: number, changes: Partial<LocalTask>) =>
    setLocalTasks(prev => {
      const exists = prev.find(t => t.id === taskId);
      if (exists) {
        return prev.map(t => t.id === taskId ? { ...t, ...changes } : t);
      } else {
        // New task confirmed
        return [...prev, { ...(changes as LocalTask), order_index: prev.length }];
      }
    });

  const handleReorder = (reordered: LocalTask[]) =>
    setLocalTasks(reordered.map((t, i) => ({ ...t, order_index: i })));

  const handleAddTask = () => {
    const lid = nextLocalId.current--;
    const task: LocalTask = {
      id: lid, template_id: null, isExtra: true, title: "Nueva tarea",
      description: "",
      area_id: null, area_name: null, assigned_user_id: null, assigned_user_name: null,
      assign_to_commercial: 0, assign_mode: "auto",
      requires_quote: false, quoter_ids: [],
      order_index: localTasks.length, task_type: "execution",
    };
    // Note: NOT adding to localTasks yet
    setTaskToEdit(task);
  };

  const handleRemoveTask = (task: LocalTask) => {
    setLocalTasks(prev => prev.filter(t => t.id !== task.id).map((t, i) => ({ ...t, order_index: i })));
  };

  const handleSubmit = async () => {
    const tasks = localTasks.map(t => ({
      template_id: t.template_id ?? null,
      title: t.title,
      description: t.description,
      assigned_user_id: t.assigned_user_id,
      assign_to_commercial: t.assign_to_commercial,
      area_id: t.area_id,
      task_type: t.task_type,
      requires_quote: t.requires_quote ? 1 : 0,
      quoter_ids: t.quoter_ids,
    }));

    await onConfirm({ notes, tasks });
  };

  const STEPS = [
    { label: "Notas del ajuste", icon: FileText },
    { label: "Tareas", icon: ListTodo },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] flex flex-col p-0" aria-describedby={undefined}>
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Nuevo Ajuste</DialogTitle>
          <div className="flex items-center gap-2 mt-3">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const active = step === n;
              const done = step > n;
              const Icon = s.icon;
              return (
                <div key={n} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${active ? "bg-primary text-primary-foreground" : done ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="h-3 w-3" />
                    {s.label}
                  </div>
                  {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Describe los cambios o correcciones que se incluyen en este ajuste. Esta nota quedará registrada en el historial de versiones.
              </p>
              <div className="min-h-[280px]">
                <RichTextEditor
                  value={notes}
                  onChange={setNotes}
                  placeholder="Ej: El cliente solicitó cambiar los colores del banner y agregar el logo en la versión mobile..."
                  expandable={false}
                  title="Notas del ajuste"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Revisa las tareas para este ajuste. Puedes reordenarlas, cambiar responsables, agregar o eliminar tareas.
              </p>

              <div className="border rounded-lg bg-card overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-muted/50 border-b">
                  <div>
                    <h3 className="text-base font-semibold text-primary/80">Ajuste de tareas</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span className="text-amber-600 dark:text-amber-400 font-medium italic">Nueva iteración</span>
                      <span>•</span>
                      <span>Total: {localTasks.length} tareas</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleAddTask} className="h-8">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Agregar tarea
                  </Button>
                </div>

                <div className="p-4 space-y-4">
                  {loadingTemplates ? (
                    <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                  ) : (
                    <ProjectTaskEditorList 
                      tasks={localTasks}
                      onReorder={handleReorder}
                      onEdit={setTaskToEdit}
                      onRemove={handleRemoveTask}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-6 pt-4 border-t bg-muted/10">
          <Button
            type="button"
            variant="outline"
            onClick={() => step === 1 ? onOpenChange(false) : setStep(1)}
            disabled={isSubmitting}
          >
            {step === 1 ? "Cancelar" : <><ChevronLeft className="h-4 w-4 mr-1" />Atrás</>}
          </Button>

          {step === 1 ? (
            <Button type="button" onClick={() => setStep(2)}>
              Siguiente — Tareas
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="min-w-[140px]">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isSubmitting ? "Creando ajuste..." : "Crear Ajuste"}
            </Button>
          )}
        </div>
      </DialogContent>
      <TaskSettingsDialog
        open={!!taskToEdit}
        onOpenChange={(open) => !open && setTaskToEdit(null)}
        task={taskToEdit}
        projectId={projectId}
        onSave={(taskId, changes) => {
          updateTask(taskId, changes);
          if (taskToEdit?.id === taskId) {
            setTaskToEdit((prev) => (prev ? { ...prev, ...changes } : null));
          }
        }}
        users={users}
        createdByName={createdByName}
      />
    </Dialog>
  );
}
