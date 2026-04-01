"use client";

import { useEffect, useState } from "react";
import { ProductTaskTemplateType } from "@/lib/definitions";
import { SortableList } from "@/components/ui/sortable-list";
import { TaskAssignmentSelector, AssignMode } from "@/components/tasks/TaskAssignmentSelector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pencil,
  Trash2,
  Clock,
  ShieldCheck,
  User,
} from "lucide-react";

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface UserOption {
  id: number;
  name: string;
  rol_id: number;
  is_internal: number;
  area_id: number | null;
  area_name: string | null;
  active_task_count: number;
}

export interface LocalTask {
  id: number;
  template_id: number | null;
  isExtra: boolean;
  title: string;
  description: string;
  area_id: number | null;
  area_name: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  assign_to_commercial: number;
  assign_mode: AssignMode;
  requires_quote: boolean;
  quoter_ids: number[];
  order_index: number;
  task_type: "execution" | "validation";
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────

export function deriveAssignMode(task: Partial<LocalTask>): AssignMode {
  if (task.assign_to_commercial === 1) return "commercial";
  if (task.assigned_user_id !== null) return "specific";
  return "auto";
}

export function resolveAssigneeName(task: Partial<LocalTask>, users: UserOption[], createdByName?: string | null): string | null {
  const mode = deriveAssignMode(task);
  if (task.requires_quote) return null;
  if (mode === "specific" && task.assigned_user_id) {
    return users.find(u => u.id === task.assigned_user_id)?.name ?? null;
  }
  if (mode === "commercial") {
    return createdByName || "Comercial del proyecto";
  }
  if (mode === "auto" && task.area_id) {
    const u = users.find(u => u.area_id === task.area_id && u.rol_id === 4 && u.is_internal === 1);
    return u?.name ?? null;
  }
  return null;
}

// ─── Shared Task Settings Dialog ──────────────────────────────────────────────

interface TaskSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: LocalTask | null;
  projectId?: number;
  onSave: (taskId: number, changes: Partial<LocalTask>) => void;
  users: UserOption[];
  createdByName?: string | null;
}

export function TaskSettingsDialog({ open, onOpenChange, task, projectId, onSave, users, createdByName }: TaskSettingsDialogProps) {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftType, setDraftType] = useState<"execution" | "validation">("execution");

  useEffect(() => {
    if (task) {
      setDraftTitle(task.title);
      setDraftDescription(task.description || "");
      setDraftType(task.task_type);
    }
  }, [task, open]);

  if (!task) return null;

  const handleDone = () => {
    onSave(task.id, {
      title: draftTitle,
      description: draftDescription,
      task_type: draftType,
    });
    onOpenChange(false);
  };

  const resolveAndSave = (changes: Partial<LocalTask>) => {
    const nextTask = { ...task, ...changes };
    const resolvedName = resolveAssigneeName(nextTask, users, createdByName);
    onSave(task.id, { ...changes, assigned_user_name: resolvedName });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar tarea</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Título</label>
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Título de la tarea"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Descripción (opcional)</label>
            <Input
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              placeholder="Añade detalles sobre esta tarea..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de tarea</label>
            <Select 
              value={draftType} 
              onValueChange={(v) => setDraftType(v as "execution" | "validation")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="execution">Ejecución</SelectItem>
                <SelectItem value="validation">Validación</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              id="requires_quote_shared"
              checked={task.requires_quote}
              onCheckedChange={(checked) => resolveAndSave({ 
                requires_quote: !!checked, 
                assigned_user_id: checked ? null : task.assigned_user_id,
                assign_mode: checked ? "auto" : task.assign_mode
              })}
            />
            <div className="space-y-1 -mt-1">
              <label htmlFor="requires_quote_shared" className="text-sm font-medium leading-none cursor-pointer">
                Requiere cotización de externo
              </label>
              <p className="text-xs text-muted-foreground">
                El flujo se bloqueará hasta que un externo presente su propuesta y sea aceptada.
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <TaskAssignmentSelector
              assignMode={task.assign_mode}
              onAssignModeChange={(mode) => resolveAndSave({ assign_mode: mode })}
              areaId={task.area_id}
              onAreaIdChange={(id) => resolveAndSave({ 
                area_id: id, 
                area_name: users.find(u => u.area_id === id)?.area_name ?? null 
              })}
              assignedUserId={task.assigned_user_id}
              onAssignedUserIdChange={(id) => resolveAndSave({ assigned_user_id: id })}
              quoterIds={task.quoter_ids}
              onQuoterIdsChange={(ids) => resolveAndSave({ quoter_ids: ids })}
              requiresQuote={task.requires_quote}
              projectId={projectId}
            />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button onClick={handleDone}>Listo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared Task Card ─────────────────────────────────────────────────────────

interface TaskCardProps {
  task: LocalTask;
  dragHandle: React.ReactNode;
  onEdit: (task: LocalTask) => void;
  onRemove: (task: LocalTask) => void;
}

export function TaskCard({ task, dragHandle, onEdit, onRemove }: TaskCardProps) {
  const isValidation = task.task_type === "validation";
  
  return (
    <div className="flex items-start gap-3 rounded-md border bg-card p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex-shrink-0 pt-0.5">{dragHandle}</div>
      
      <div className="flex-shrink-0 pt-1 pl-1">
        <Clock className="h-4 w-4 text-muted-foreground/50" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-2 mb-0.5">
          <p className="font-semibold text-sm leading-snug">{task.title}</p>
          <span className="text-muted-foreground/40 text-xs select-none">·</span>
          <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${isValidation ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
            {isValidation && <ShieldCheck className="h-2.5 w-2.5 mr-1" />}
            {isValidation ? "Validación" : "Ejecución"}
          </Badge>
          {task.requires_quote && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-amber-700 border-amber-400 bg-amber-50">
              Cotización requerida
            </Badge>
          )}
          {task.isExtra && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-emerald-700 border-emerald-400 bg-emerald-50">
              Nueva
            </Badge>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {task.area_name && (
            <>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 uppercase font-semibold tracking-wider">
                {task.area_name}
              </Badge>
              <span className="text-muted-foreground/40 text-xs select-none">·</span>
            </>
          )}
          {task.assigned_user_name ? (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 flex items-center gap-1">
              <User className="h-2.5 w-2.5" />
              {task.assigned_user_name}
              {task.assign_mode === "auto" && <span className="text-[9px] opacity-60 ml-0.5 italic">(auto)</span>}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground border-dashed">
               Sin asignar
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
          En espera
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onEdit(task)}
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onRemove(task)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Shared Task Editor List ──────────────────────────────────────────────────

interface ProjectTaskEditorListProps {
  tasks: LocalTask[];
  onReorder: (tasks: LocalTask[]) => void;
  onEdit: (task: LocalTask) => void;
  onRemove: (task: LocalTask) => void;
}

export function ProjectTaskEditorList({ tasks, onReorder, onEdit, onRemove }: ProjectTaskEditorListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 border rounded-lg border-dashed">
        <p className="text-sm text-muted-foreground">No hay tareas definidas.</p>
      </div>
    );
  }

  return (
    <SortableList
      items={tasks}
      onReorder={onReorder}
      renderItem={(task, dragHandle) => (
        <TaskCard 
          task={task} 
          dragHandle={dragHandle} 
          onEdit={onEdit} 
          onRemove={onRemove} 
        />
      )}
    />
  );
}
