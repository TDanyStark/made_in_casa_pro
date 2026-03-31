"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import { ProductTaskTemplateType } from "@/lib/definitions";
import { SortableList } from "@/components/ui/sortable-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, Pencil, Check, X, User, Plus, Trash2 } from "lucide-react";
import { WizardState, TaskOverride, ExtraTask } from "@/hooks/useProjectWizard";

// ─── User option for assignee picker ─────────────────────────────────────────

interface UserOption {
  id: number;
  name: string;
  rol_id: number;
  is_internal: number;
  area_id: number | null;
  area_name: string | null;
  active_task_count: number;
}

// ─── Local task row — template data + local overrides ────────────────────────

interface LocalTask {
  id: number;           // for template tasks: template_id; for extra tasks: negative localId
  template_id: number | null;  // null for extra tasks
  isExtra: boolean;
  title: string;
  area_id: number | null;
  area_name: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  assign_to_commercial: number;
  order_index: number;
  task_type: "execution" | "validation";
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  state: WizardState;
  onNext: (data: Partial<WizardState>) => void;
  onBack: () => void;
  update: (data: Partial<WizardState>) => void;
}

// ─── Inline editable title ────────────────────────────────────────────────────

interface InlineTitleProps {
  taskId: number;
  value: string;
  autoFocus?: boolean;
  onSave: (newTitle: string) => void;
}

function InlineTitle({ taskId, value, autoFocus, onSave }: InlineTitleProps) {
  const [editing, setEditing] = useState(autoFocus ?? false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // When autoFocus prop changes (new task added), enter edit mode
  useEffect(() => {
    if (autoFocus) {
      setDraft(value);
      setEditing(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim() || value;
    if (trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 flex-1">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          className="h-7 text-sm py-0 px-2"
        />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); commit(); }}
          className="text-primary hover:text-primary/80 p-0.5"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); cancel(); }}
          className="text-muted-foreground hover:text-destructive p-0.5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(value); setEditing(true); }}
      className="group flex items-center gap-1.5 text-left text-sm font-medium hover:text-primary transition-colors"
    >
      {value}
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
    </button>
  );
}

// ─── Assignee picker ──────────────────────────────────────────────────────────

interface AssigneePickerProps {
  task: LocalTask;
  users: UserOption[];
  onAssign: (userId: number | null, userName: string | null, assignToCommercial?: number) => void;
}

function AssigneePicker({ task, users, onAssign }: AssigneePickerProps) {
  const currentValue = task.assigned_user_id
    ? task.assigned_user_id.toString()
    : task.assign_to_commercial === 1
    ? "commercial"
    : "none";

  const suggestedName = task.area_id
    ? users.find(u => u.area_id === task.area_id && u.rol_id === 4 && u.is_internal === 1)?.name
    : null;

  const admins = users.filter((u) => u.rol_id === 1);
  const directivos = users.filter((u) => u.rol_id === 2);
  const comerciales = users.filter((u) => u.rol_id === 3);
  const internals = users.filter((u) => u.rol_id === 4 && u.is_internal === 1);
  const externals = users.filter((u) => u.rol_id === 4 && u.is_internal === 0);

  const handleChange = (value: string) => {
    if (value === "none") {
      onAssign(null, null, 0);
    } else if (value === "commercial") {
      onAssign(null, null, 1);
    } else {
      const user = users.find((u) => u.id.toString() === value);
      onAssign(user?.id ?? null, user?.name ?? null, 0);
    }
  };

  const renderGroup = (label: string, groupUsers: UserOption[]) => {
    if (groupUsers.length === 0) return null;
    return (
      <SelectGroup>
        <SelectLabel className="text-xs text-muted-foreground/60 font-normal py-1 px-2 uppercase tracking-wider">
          {label}
        </SelectLabel>
        {groupUsers.map((u) => (
          <SelectItem key={u.id} value={u.id.toString()}>
            <span className="flex items-center gap-1.5">
              {u.name}
              {u.area_name && (
                <span className="text-xs text-muted-foreground">· {u.area_name}</span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectGroup>
    );
  };

  const displayLabel = task.assigned_user_name || "Sin asignar";

  return (
    <Select value={currentValue} onValueChange={handleChange}>
      <SelectTrigger className="h-7 text-xs w-auto min-w-[140px] max-w-[200px] gap-1 px-2">
        <User className="h-3 w-3 text-muted-foreground shrink-0" />
        <SelectValue>
          <span className={!task.assigned_user_name ? "text-muted-foreground" : ""}>
            {displayLabel}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <div className="flex flex-col gap-0.5 py-0.5">
            <span className="text-xs font-medium">
              {task.area_name ? `Auto (${task.area_name})` : "Sin asignar"}
            </span>
            {suggestedName && (
              <span className="text-[10px] text-muted-foreground">
                Sugerido: {suggestedName}
              </span>
            )}
          </div>
        </SelectItem>
        <SelectItem value="commercial">
          <span className="text-xs">Comercial del proyecto</span>
        </SelectItem>
        <SelectSeparator />
        {renderGroup("Admin", admins)}
        {directivos.length > 0 && admins.length > 0 && <SelectSeparator />}
        {renderGroup("Directivo", directivos)}
        {comerciales.length > 0 && (admins.length > 0 || directivos.length > 0) && <SelectSeparator />}
        {renderGroup("Comercial", comerciales)}
        {internals.length > 0 && <SelectSeparator />}
        {renderGroup("Colaborador interno", internals)}
        {externals.length > 0 && <SelectSeparator />}
        {renderGroup("Colaborador externo", externals)}
      </SelectContent>
    </Select>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WizardStep4Tasks({ state, onNext, onBack, update }: Props) {
  const productId = state.product?.id ?? null;

  // Fetch task templates for the selected product
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

  // Fetch all users for assignee picker
  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ["all-users-for-wizard-tasks"],
    queryFn: async () => {
      const res = await get<UserOption[]>(`collaborators?all_users=1`);
      return res.ok ? (res.data ?? []) : [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Local task list — initialized from templates + any existing overrides/extras
  const [localTasks, setLocalTasks] = useState<LocalTask[]>([]);
  const [removedTemplateIds, setRemovedTemplateIds] = useState<number[]>([]);
  const [newTaskId, setNewTaskId] = useState<number | null>(null);

  // Counter for generating negative temp IDs for extra tasks
  const nextLocalId = useRef<number>(-1);
  const initialized = useRef(false);

  useEffect(() => {
    if (templates.length === 0 && (state.extra_tasks?.length ?? 0) === 0) {
      initialized.current = false;
      setLocalTasks([]);
      return;
    }

    if (initialized.current && localTasks.length > 0) {
      // If already initialized but name was fallback, update names
      const hasFallbackName = localTasks.some(t => t.assign_to_commercial === 1 && t.assigned_user_name === "Comercial del proyecto");
      if (hasFallbackName && state.created_by_name) {
        setLocalTasks(prev => prev.map(t => 
          t.assign_to_commercial === 1 ? { ...t, assigned_user_name: state.created_by_name } : t
        ));
      }
      return;
    }
    
    if (users.length === 0) return; // Wait for users to be loaded to resolve auto-assignees
    initialized.current = true;

    const removedIds = state.removed_template_ids ?? [];
    setRemovedTemplateIds(removedIds);

    // Helper to resolve auto-assignee name
    const getResolvedAssignee = (task: Partial<LocalTask>) => {
      // 1. Specific user already set in override or template
      if (task.assigned_user_id) {
        const u = users.find((u) => u.id === task.assigned_user_id);
        return { id: u?.id ?? null, name: u?.name ?? null };
      }
      // 2. Assign to commercial (the user who creates the project)
      if (task.assign_to_commercial === 1) {
        return { id: null, name: state.created_by_name || "Comercial del proyecto" };
      }
      // 3. Area-based auto assign
      if (task.area_id) {
        const areaUsers = users.filter(u => u.area_id === task.area_id && u.rol_id === 4 && u.is_internal === 1);
        if (areaUsers.length > 0) {
          return { id: null, name: areaUsers[0].name };
        }
      }
      return { id: null, name: null };
    };

    // 1. Prepare template-based tasks
    const templateTasks: LocalTask[] = templates
      .filter((t) => !removedIds.includes(t.id))
      .map((t) => {
        const existing = state.task_overrides.find((o) => o.template_id === t.id);
        const resolvedUserId = existing?.assigned_user_id !== undefined
          ? existing.assigned_user_id
          : t.assigned_user_id;
        
        const assignToComm = existing?.assign_to_commercial !== undefined
          ? existing.assign_to_commercial
          : t.assign_to_commercial;

        const { name: resolvedUserName } = getResolvedAssignee({
          assigned_user_id: resolvedUserId,
          assign_to_commercial: assignToComm,
          area_id: t.area_id
        });

        return {
          id: t.id,
          template_id: t.id,
          isExtra: false,
          title: existing?.title ?? t.title,
          area_id: t.area_id,
          area_name: t.area_name,
          assigned_user_id: resolvedUserId,
          assigned_user_name: resolvedUserName,
          assign_to_commercial: assignToComm,
          order_index: existing?.order_index ?? t.order_index,
          task_type: existing?.task_type ?? t.task_type,
        };
      });

    // 2. Prepare extra tasks from wizard state
    const extraRows: LocalTask[] = (state.extra_tasks ?? []).map((e) => {
      const { name: resolvedUserName } = getResolvedAssignee({
        assigned_user_id: e.assigned_user_id,
        assign_to_commercial: e.assign_to_commercial,
        area_id: e.area_id
      });

      return {
        id: e.localId,
        template_id: null,
        isExtra: true,
        title: e.title,
        area_id: e.area_id,
        area_name: null,
        assigned_user_id: e.assigned_user_id,
        assigned_user_name: resolvedUserName,
        assign_to_commercial: e.assign_to_commercial ?? 0,
        order_index: e.order_index,
        task_type: e.task_type,
      };
    });

    // 3. Combine and sort by order_index
    setLocalTasks([...templateTasks, ...extraRows].sort((a, b) => a.order_index - b.order_index));

    // Update nextLocalId based on existing extra tasks
    if (state.extra_tasks?.length > 0) {
      const minId = Math.min(...state.extra_tasks.map(e => e.localId));
      if (minId < 0) nextLocalId.current = minId - 1;
    }
  }, [templates, users, state.task_overrides, state.extra_tasks, state.removed_template_ids, state.created_by_name]);

  // Sync state to wizard — called on every meaningful change
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
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...changes } : t))
    );
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
      area_id: null,
      area_name: null,
      assigned_user_id: null,
      assigned_user_name: null,
      assign_to_commercial: 0,
      order_index: localTasks.length,
      task_type: "execution",
    };
    const updated = [...localTasks, newTask];
    setLocalTasks(updated);
    setNewTaskId(localId);
    syncWizardState(updated, removedTemplateIds);
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

  const handleNext = () => {
    onNext({});
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!productId) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
          <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Selecciona un producto en el paso anterior para ver las tareas
          </p>
        </div>
        <div className="flex justify-between pt-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Atrás
          </Button>
          <Button type="button" onClick={handleNext}>
            Siguiente
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Revisa y ajusta las tareas que se crearán para{" "}
        <span className="font-medium text-foreground">{state.product?.name}</span>.
        Puedes reordenarlas, editar sus títulos, cambiar los responsables, agregar tareas nuevas o eliminar las que no necesites.
      </p>

      {localTasks.length > 0 ? (
        <SortableList
          items={localTasks}
          onReorder={handleReorder}
          renderItem={(task, dragHandle) => (
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2.5">
              <div className="flex-shrink-0">{dragHandle}</div>

              <span className="text-xs text-muted-foreground font-mono w-5 shrink-0 text-center">
                {localTasks.findIndex((t) => t.id === task.id) + 1}
              </span>

              <div className="flex-1 min-w-0">
                <InlineTitle
                  taskId={task.id}
                  value={task.title}
                  autoFocus={task.id === newTaskId}
                  onSave={(newTitle) => {
                    updateTask(task.id, { title: newTitle });
                    if (task.id === newTaskId) setNewTaskId(null);
                    syncWizardState(
                      localTasks.map((t) => t.id === task.id ? { ...t, title: newTitle } : t),
                      removedTemplateIds
                    );
                  }}
                />
                {task.area_name && (
                  <Badge variant="secondary" className="text-xs mt-0.5">
                    {task.area_name}
                  </Badge>
                )}
                {task.isExtra && (
                  <Badge variant="outline" className="text-xs mt-0.5 text-muted-foreground">
                    Nueva
                  </Badge>
                )}
              </div>

              <div className="flex-shrink-0 flex items-center gap-1">
                <AssigneePicker
                  task={task}
                  users={users}
                  onAssign={(userId, userName, assignToCommercial) => {
                    const assignToComm = assignToCommercial ?? task.assign_to_commercial;
                    
                    // Resolve the new name
                    let resolvedName = userName;
                    if (!userId) {
                      if (assignToComm === 1) {
                        resolvedName = state.created_by_name || "Comercial del proyecto";
                      } else if (task.area_id) {
                        const areaUsers = users.filter(u => u.area_id === task.area_id && u.rol_id === 4 && u.is_internal === 1);
                        if (areaUsers.length > 0) {
                          resolvedName = areaUsers[0].name;
                        }
                      }
                    }

                    const updated = localTasks.map((t) =>
                      t.id === task.id
                        ? { 
                            ...t, 
                            assigned_user_id: userId, 
                            assigned_user_name: resolvedName,
                            assign_to_commercial: assignToComm
                          }
                        : t
                    );
                    setLocalTasks(updated);
                    syncWizardState(updated, removedTemplateIds);
                  }}
                />
                <Select
                  value={task.task_type}
                  onValueChange={(v) => {
                    const type = v as "execution" | "validation";
                    const updated = localTasks.map((t) =>
                      t.id === task.id ? { ...t, task_type: type } : t
                    );
                    setLocalTasks(updated);
                    syncWizardState(updated, removedTemplateIds);
                  }}
                >
                  <SelectTrigger className="h-7 text-xs w-[100px] gap-1 px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="execution">Ejecución</SelectItem>
                    <SelectItem value="validation" disabled={localTasks.indexOf(task) === 0}>
                      Validación
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  type="button"
                  onClick={() => handleRemoveTask(task)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg border-dashed">
          <Package className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            No hay tareas. Puedes agregar tareas personalizadas.
          </p>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={handleAddTask}
        className="w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Agregar tarea
      </Button>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Atrás
        </Button>
        <Button type="button" onClick={handleNext}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}
