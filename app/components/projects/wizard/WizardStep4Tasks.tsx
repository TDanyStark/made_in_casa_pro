"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import { ProductTaskTemplateType } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, Package, Plus } from "lucide-react";
import { WizardState, TaskOverride, ExtraTask } from "@/hooks/useProjectWizard";
import {
  ProjectTaskEditorList,
  TaskSettingsDialog,
  LocalTask,
  UserOption,
  deriveAssignMode,
  resolveAssigneeName,
} from "../shared/ProjectTaskEditor";

interface Props {
  state: WizardState;
  onNext: (data: Partial<WizardState>) => void;
  onBack: () => void;
  update: (data: Partial<WizardState>) => void;
}

export function WizardStep4Tasks({ state, onNext, onBack, update }: Props) {
  const productId = state.product?.id ?? null;

  const { data: templates = [], isLoading } = useQuery<ProductTaskTemplateType[]>({
    queryKey: ["product-task-templates", productId],
    queryFn: async () => {
      if (!productId) return [];
      const res = await get<ProductTaskTemplateType[]>(`products/${productId}/tasks`);
      return res.ok ? (res.data ?? []) : [];
    },
    enabled: !!productId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ["all-users-for-wizard-tasks"],
    queryFn: async () => {
      const res = await get<UserOption[]>(`collaborators?all_users=1`);
      return res.ok ? (res.data ?? []) : [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const [localTasks, setLocalTasks] = useState<LocalTask[]>([]);
  const [removedTemplateIds, setRemovedTemplateIds] = useState<number[]>([]);
  const [taskToEdit, setTaskToEdit] = useState<LocalTask | null>(null);

  const nextLocalId = useRef<number>(-1);
  const initialized = useRef(false);

  useEffect(() => {
    if (templates.length === 0 && (state.extra_tasks?.length ?? 0) === 0) {
      initialized.current = false;
      setLocalTasks([]);
      return;
    }

    if (initialized.current) return;
    if (users.length === 0) return;
    initialized.current = true;

    const removedIds = state.removed_template_ids ?? [];
    setRemovedTemplateIds(removedIds);

    const templateTasks: LocalTask[] = templates
      .filter((t) => !removedIds.includes(t.id))
      .map((t) => {
        const existing = state.task_overrides.find((o) => o.template_id === t.id);
        const resolvedUserId = existing?.assigned_user_id !== undefined ? existing.assigned_user_id : t.assigned_user_id;
        const assignToComm = existing?.assign_to_commercial !== undefined ? existing.assign_to_commercial : t.assign_to_commercial;

        const partialTask = {
          assigned_user_id: resolvedUserId,
          assign_to_commercial: assignToComm,
          area_id: t.area_id,
          requires_quote: t.requires_quote === 1,
        };

        const resolvedUserName = resolveAssigneeName(partialTask, users, state.created_by_name);

        return {
          id: t.id,
          template_id: t.id,
          isExtra: false,
          title: existing?.title ?? t.title,
          description: t.description || "",
          area_id: t.area_id,
          area_name: t.area_name,
          assigned_user_id: resolvedUserId,
          assigned_user_name: resolvedUserName,
          assign_to_commercial: assignToComm,
          assign_mode: deriveAssignMode(partialTask),
          requires_quote: t.requires_quote === 1,
          quoter_ids: t.quoters?.map(q => q.user_id) ?? [],
          order_index: existing?.order_index ?? t.order_index,
          task_type: existing?.task_type ?? t.task_type,
        };
      });

    const extraRows: LocalTask[] = (state.extra_tasks ?? []).map((e) => {
      const partialTask = {
        assigned_user_id: e.assigned_user_id,
        assign_to_commercial: e.assign_to_commercial,
        area_id: e.area_id,
        requires_quote: false,
      };

      const resolvedUserName = resolveAssigneeName(partialTask, users, state.created_by_name);

      return {
        id: e.localId,
        template_id: null,
        isExtra: true,
        title: e.title,
        description: "",
        area_id: e.area_id,
        area_name: null,
        assigned_user_id: e.assigned_user_id,
        assigned_user_name: resolvedUserName,
        assign_to_commercial: e.assign_to_commercial ?? 0,
        assign_mode: deriveAssignMode(partialTask),
        requires_quote: false,
        quoter_ids: [],
        order_index: e.order_index,
        task_type: e.task_type,
      };
    });

    setLocalTasks([...templateTasks, ...extraRows].sort((a, b) => a.order_index - b.order_index));
  }, [templates, users, state, state.task_overrides, state.extra_tasks, state.removed_template_ids]);

  const syncWizardState = (tasks: LocalTask[], removedIds: number[]) => {
    const task_overrides: TaskOverride[] = tasks
      .filter((t) => t.template_id !== null)
      .map((t) => ({
        template_id: t.template_id!,
        title: t.title,
        assigned_user_id: t.assigned_user_id,
        assign_to_commercial: t.assign_to_commercial,
        order_index: tasks.indexOf(t),
        task_type: t.task_type,
      }));

    const extra_tasks: ExtraTask[] = tasks
      .filter((t) => t.isExtra)
      .map((t) => ({
        localId: t.id,
        title: t.title,
        assigned_user_id: t.assigned_user_id,
        assign_to_commercial: t.assign_to_commercial,
        area_id: t.area_id,
        task_type: t.task_type,
        order_index: tasks.indexOf(t),
      }));

    update({ task_overrides, extra_tasks, removed_template_ids: removedIds });
  };

  const updateTask = (taskId: number, changes: Partial<LocalTask>) => {
    setLocalTasks((prev) => {
      const exists = prev.find((t) => t.id === taskId);
      let updated;
      if (exists) {
        updated = prev.map((t) => (t.id === taskId ? { ...t, ...changes } : t));
      } else {
        // It's a new task confirmed in the dialog
        updated = [...prev, { ...(changes as LocalTask), order_index: prev.length }];
      }
      syncWizardState(updated, removedTemplateIds);
      return updated;
    });
  };

  const handleReorder = (reordered: LocalTask[]) => {
    const updated = reordered.map((t, idx) => ({ ...t, order_index: idx }));
    setLocalTasks(updated);
    syncWizardState(updated, removedTemplateIds);
  };

  const handleAddTask = () => {
    const localId = nextLocalId.current--;
    const newTask: LocalTask = {
      id: localId,
      template_id: null,
      isExtra: true,
      title: "Nueva tarea",
      description: "",
      area_id: null,
      area_name: null,
      assigned_user_id: null,
      assigned_user_name: null,
      assign_to_commercial: 0,
      assign_mode: "auto",
      requires_quote: false,
      quoter_ids: [],
      order_index: localTasks.length,
      task_type: "execution",
    };
    // Note: NOT adding to localTasks yet
    setTaskToEdit(newTask);
  };

  const handleRemoveTask = (task: LocalTask) => {
    const updated = localTasks
      .filter((t) => t.id !== task.id)
      .map((t, idx) => ({ ...t, order_index: idx }));

    let updatedRemovedIds = removedTemplateIds;
    if (task.template_id !== null) {
      updatedRemovedIds = [...removedTemplateIds, task.template_id];
      setRemovedTemplateIds(updatedRemovedIds);
    }

    setLocalTasks(updated);
    syncWizardState(updated, updatedRemovedIds);
  };

  if (!productId) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
          <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Selecciona un producto en el paso anterior</p>
        </div>
        <div className="flex justify-between pt-2">
          <Button type="button" variant="outline" onClick={onBack}>Atrás</Button>
          <Button type="button" onClick={() => onNext({})}>Siguiente</Button>
        </div>
      </div>
    );
  }

  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Tareas del proyecto</h2>
        <p className="text-sm text-muted-foreground">
          Revisa y ajusta las tareas para <span className="font-medium text-foreground">{state.product?.name}</span>.
        </p>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-muted/50 border-b">
          <div>
            <h3 className="text-base font-semibold text-primary/80">Versión 1 (Original)</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="text-amber-600 dark:text-amber-400 font-medium italic">Se creará con el proyecto</span>
              <span>•</span>
              <span>Total: {localTasks.length} tareas</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <Button variant="outline" size="sm" onClick={handleAddTask} className="h-8">
               <Plus className="h-3.5 w-3.5 mr-1.5" />
               Agregar tarea
             </Button>
             <div className="p-1 text-muted-foreground">
               <ChevronDown className="h-5 w-5" />
             </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <ProjectTaskEditorList 
            tasks={localTasks}
            onReorder={handleReorder}
            onEdit={setTaskToEdit}
            onRemove={handleRemoveTask}
          />
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>Atrás</Button>
        <Button type="button" onClick={() => onNext({})}>Siguiente</Button>
      </div>

      <TaskSettingsDialog
        open={!!taskToEdit}
        onOpenChange={(open) => !open && setTaskToEdit(null)}
        task={taskToEdit}
        onSave={updateTask}
        users={users}
        createdByName={state.created_by_name}
      />
    </div>
  );
}
