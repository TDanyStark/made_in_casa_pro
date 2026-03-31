"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { 
  CheckCircle, 
  Loader2, 
  AlertCircle
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProjectTaskType } from "@/lib/definitions";
import { toast } from "sonner";
import { post } from "@/lib/services/apiService";

const RichTextEditor = dynamic(
  () => import("@/components/clients/RichTextEditor").then((mod) => mod.RichTextEditor),
  { ssr: false, loading: () => <div className="h-40 w-full animate-pulse bg-muted rounded-md" /> }
);

interface TaskCompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ProjectTaskType | null;
  onSuccess: () => void;
}

export function TaskCompleteDialog({
  open,
  onOpenChange,
  task,
  onSuccess,
}: TaskCompleteDialogProps) {
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isHtmlEmpty = (html: string): boolean => {
    if (!html) return true;
    const stripped = html.replace(/<[^>]*>/g, "").trim();
    return stripped.length === 0;
  };

  const handleConfirm = async () => {
    if (isHtmlEmpty(notes)) {
      toast.error("Por favor, agrega una nota de los entregables antes de completar.");
      return;
    }

    if (!task) return;

    setIsLoading(true);
    try {
      const res = await post(`projects/${task.project_id}/tasks/${task.id}/complete`, { notes });
      
      if (!res.ok) throw new Error(res.error || "Error al completar la tarea");

      const data = res.data as { blockedReason?: string | null };
      if (data?.blockedReason) {
        toast.warning(data.blockedReason, { duration: 6000 });
      } else {
        toast.success("Tarea completada correctamente");
      }

      onSuccess();
      onOpenChange(false);
      setNotes("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al completar la tarea");
    } finally {
      setIsLoading(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col p-0" aria-describedby={undefined}>
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Completar Tarea y Entregar
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-4">
          <div className="bg-muted/30 p-3 rounded-md border border-dashed flex items-start gap-3">
             <div className="shrink-0 mt-0.5">
                <AlertCircle className="h-4 w-4 text-primary" />
             </div>
             <div>
                <p className="text-sm font-medium">Tarea: {task.title}</p>
                <p className="text-[11px] text-muted-foreground">Al completar esta tarea, el flujo avanzará automáticamente al siguiente paso.</p>
             </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">
              Nota de Entregables / Resultados <span className="text-destructive">*</span>
            </label>
            <div className="min-h-[250px]">
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                placeholder="Describe aquí lo que se entrega, links relevantes, o cualquier nota importante para el siguiente paso..."
                expandable={true}
                title="Nota de entrega"
              />
            </div>
            <p className="text-[11px] text-muted-foreground italic">
              Esta nota quedará en el historial de la tarea para consulta futura.
            </p>
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
            disabled={isLoading || isHtmlEmpty(notes)}
            className="min-w-[140px] gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Completar y Entregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
