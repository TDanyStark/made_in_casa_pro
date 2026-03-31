"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { 
  ShieldCheck, 
  CheckCircle, 
  ChevronDown, 
  Loader2, 
  AlertTriangle 
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ProjectTaskType } from "@/lib/definitions";
import { toast } from "sonner";
import { post } from "@/lib/services/apiService";

// Dynamic import of RichTextEditor (ssr: false because it depends on browser APIs)
const RichTextEditor = dynamic(
  () => import("@/components/clients/RichTextEditor").then((mod) => mod.RichTextEditor),
  { ssr: false, loading: () => <div className="h-40 w-full animate-pulse bg-muted rounded-md" /> }
);

interface TaskValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ProjectTaskType | null;
  siblings: ProjectTaskType[];
  onSuccess: () => void;
}

/**
 * Utility function to check if HTML content is effectively empty.
 * Strips HTML tags and checks if remaining text is just whitespace.
 */
const isHtmlEmpty = (html: string): boolean => {
  if (!html) return true;
  // Strip tags and trim
  const stripped = html.replace(/<[^>]*>/g, "").trim();
  // Also handle common TipTap empty paragraph case: <p></p> or <p><br></p>
  if (stripped.length === 0) return true;
  return false;
};

export function TaskValidationDialog({
  open,
  onOpenChange,
  task,
  siblings,
  onSuccess,
}: TaskValidationDialogProps) {
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [notes, setNotes] = useState("");
  const [targetTaskId, setTargetTaskId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when dialog opens with a new task
  useEffect(() => {
    if (open) {
      setAction("approve");
      setNotes("");
      setTargetTaskId("");
    }
  }, [open]);

  if (!task) return null;

  const isCorrection = task.task_flag === "correction";
  const lastValIndex = isCorrection
    ? Math.max(
        ...siblings
          .filter(
            (t) =>
              t.task_type === "validation" &&
              t.status === "completed" &&
              t.order_index < task.order_index
          )
          .map((t) => t.order_index),
        -1
      )
    : -1;

  const isRejectAction = action === "reject";
  const isNotesEmpty = isHtmlEmpty(notes);
  const isTargetNotSelected = isRejectAction && !targetTaskId;
  
  // Validation: Mandatory notes and target task on rejection
  const isConfirmDisabled = isLoading || (isRejectAction && (isNotesEmpty || isTargetNotSelected));

  const handleConfirm = async () => {
    if (isRejectAction && isNotesEmpty) {
      toast.error("Por favor, explica el motivo del rechazo en las notas.");
      return;
    }

    if (isRejectAction && isTargetNotSelected) {
      toast.error("Selecciona a qué tarea regresar.");
      return;
    }

    setIsLoading(true);
    try {
      interface ValidationBody {
        action: "approve" | "reject";
        notes: string | null;
        targetTaskId?: number;
        [key: string]: string | number | null | undefined;
      }

      const body: ValidationBody = {
        action,
        notes: notes || null,
      };

      if (isRejectAction) {
        body.targetTaskId = parseInt(targetTaskId);
      }

      const res = await post(`projects/${task.project_id}/tasks/${task.id}/validate`, body);
      
      if (!res.ok) throw new Error(res.error || "Error al validar la tarea");

      const data = res.data as { blockedReason?: string | null };
      
      if (action === "approve") {
        if (data?.blockedReason) {
          toast.warning(data.blockedReason, { duration: 6000 });
        } else {
          toast.success("Validación aprobada");
        }
      } else {
        toast.success("Enviado a corrección");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al procesar la validación");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col p-0" aria-describedby={undefined}>
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-purple-600" />
            Validar tarea
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-6">
          <div className="bg-muted/30 p-3 rounded-md border border-dashed">
            <p className="text-sm text-muted-foreground">
              Tarea: <span className="font-medium text-foreground">{task.title}</span>
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2">
              ¿Cuál es el resultado de la revisión?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAction("approve")}
                className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 text-center transition-all ${
                  action === "approve"
                    ? "border-green-500 bg-green-50 text-green-700 shadow-sm"
                    : "border-muted bg-background hover:border-input text-muted-foreground"
                }`}
              >
                <CheckCircle className={`h-6 w-6 mb-2 ${action === "approve" ? "text-green-600" : "text-muted-foreground/50"}`} />
                <span className="font-bold uppercase text-xs tracking-wider">Aprobar</span>
                <span className="text-[10px] mt-1 opacity-80">Continuar con el proceso</span>
              </button>
              
              <button
                type="button"
                onClick={() => setAction("reject")}
                className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 text-center transition-all ${
                  action === "reject"
                    ? "border-destructive bg-destructive/5 text-destructive shadow-sm"
                    : "border-muted bg-background hover:border-input text-muted-foreground"
                }`}
              >
                <ChevronDown className={`h-6 w-6 mb-2 rotate-180 ${action === "reject" ? "text-destructive" : "text-muted-foreground/50"}`} />
                <span className="font-bold uppercase text-xs tracking-wider">Rechazar</span>
                <span className="text-[10px] mt-1 opacity-80">Solicitar correcciones</span>
              </button>
            </div>
          </div>

          {isRejectAction && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="text-sm font-semibold">Regresar al paso</label>
              <Select value={targetTaskId} onValueChange={setTargetTaskId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar tarea destino" />
                </SelectTrigger>
                <SelectContent>
                  {siblings
                    .filter((t) => {
                      const baseFilter = t.id !== task.id && t.order_index < task.order_index;
                      if (!isCorrection) return baseFilter;
                      return baseFilter && t.order_index > lastValIndex;
                    })
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        {t.order_index + 1}. {t.title}
                        {t.assigned_user_name && ` — asignado a ${t.assigned_user_name}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground italic">
                La tarea seleccionada volverá a estar &quot;En progreso&quot; para su corrección.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">
                Notas {action === "reject" ? <span className="text-destructive">*</span> : "(opcional)"}
              </label>
              {action === "reject" && isNotesEmpty && (
                <span className="text-[10px] text-destructive flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-3 w-3" /> Requerido para rechazo
                </span>
              )}
            </div>
            <div className="min-h-[200px]">
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                placeholder={
                  action === "approve"
                    ? "Opcionalmente, agrega comentarios sobre la validación..."
                    : "Describe detalladamente qué debe corregirse..."
                }
                expandable={true}
                title={`Notas de ${action === "approve" ? "aprobación" : "rechazo"}`}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 pt-4 border-t bg-muted/10">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={`min-w-[140px] gap-2 ${
              action === "reject"
                ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                : "bg-green-600 hover:bg-green-700 text-white"
            }`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              action === "approve" ? <CheckCircle className="h-4 w-4" /> : <ChevronDown className="h-4 w-4 rotate-180" />
            )}
            {action === "approve" ? "Aprobar y enviar" : "Rechazar y enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
