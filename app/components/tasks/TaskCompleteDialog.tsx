"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  CheckCircle,
  Loader2,
  AlertCircle,
  Clock,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProjectTaskType } from "@/lib/definitions";
import { toast } from "sonner";
import { post } from "@/lib/services/apiService";
import { formatProgressMinutes } from "@/lib/task-progress";

const RichTextEditor = dynamic(
  () =>
    import("@/components/clients/RichTextEditor").then(
      (mod) => mod.RichTextEditor
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-40 w-full animate-pulse bg-muted rounded-md" />
    ),
  }
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskCompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ProjectTaskType | null;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskCompleteDialog({
  open,
  onOpenChange,
  task,
  onSuccess,
}: TaskCompleteDialogProps) {
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // ── Time tracking state ──────────────────────────────────────────────────
  const [accumulatedMinutes, setAccumulatedMinutes] = useState<number>(0);
  const [hoursInput, setHoursInput] = useState("");
  const [minutesInput, setMinutesInput] = useState("");

  // ── Delivery URL ─────────────────────────────────────────────────────────
  const [deliveryUrl, setDeliveryUrl] = useState("");

  // ── Completion cost ──────────────────────────────────────────────────────
  const [completionCost, setCompletionCost] = useState("");

  useEffect(() => {
    if (open && task) {
      setAccumulatedMinutes(task.progress_minutes ?? 0);
      setHoursInput("");
      setMinutesInput("");
      setDeliveryUrl("");
      setCompletionCost(
        task.completion_cost != null ? String(task.completion_cost) : ""
      );
      setNotes("");
    }
  }, [open, task]);

  const isHtmlEmpty = (html: string): boolean => {
    if (!html) return true;
    const stripped = html.replace(/<[^>]*>/g, "").trim();
    return stripped.length === 0;
  };

  // ── Add time block ────────────────────────────────────────────────────────
  const handleAddTime = () => {
    const h = parseInt(hoursInput || "0", 10);
    const m = parseInt(minutesInput || "0", 10);
    if (isNaN(h) || isNaN(m) || h < 0 || m < 0 || m > 59) {
      toast.error("Ingresa valores válidos de horas (≥0) y minutos (0-59)");
      return;
    }
    const added = h * 60 + m;
    if (added === 0) {
      toast.error("Ingresa al menos 1 minuto para agregar");
      return;
    }
    setAccumulatedMinutes((prev) => prev + added);
    setHoursInput("");
    setMinutesInput("");
  };

  // ── Derived flags ─────────────────────────────────────────────────────────
  const isExternalCollaborator =
    task?.assigned_user_is_internal !== null &&
    task?.assigned_user_is_internal !== undefined &&
    Number(task?.assigned_user_is_internal) === 0;

  const isReadOnlyCost =
    task?.requires_quote === 1;

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    // If there's unsaved time in the inputs, block and warn
    const pendingH = hoursInput.trim();
    const pendingM = minutesInput.trim();
    if (pendingH !== "" || pendingM !== "") {
      toast.error(
        'Tienes tiempo sin agregar. Presiona "Agregar tiempo" antes de completar.'
      );
      return;
    }

    if (accumulatedMinutes === 0) {
      toast.error("Debes registrar cuánto tiempo tardaste en esta tarea.");
      return;
    }

    if (isHtmlEmpty(notes)) {
      toast.error(
        "Por favor, agrega una nota de los entregables antes de completar."
      );
      return;
    }

    if (!task) return;

    // Validate delivery_url if provided
    if (deliveryUrl && deliveryUrl.trim()) {
      try {
        new URL(deliveryUrl.trim());
      } catch {
        toast.error("El enlace entregable no es una URL válida");
        return;
      }
    }

    const parsedCost =
      completionCost && !isReadOnlyCost
        ? parseFloat(completionCost)
        : undefined;

    setIsLoading(true);
    try {
      const res = await post(
        `projects/${task.project_id}/tasks/${task.id}/complete`,
        {
          notes,
          progress_minutes: accumulatedMinutes,
          delivery_url: deliveryUrl.trim() || null,
          completion_cost:
            parsedCost !== undefined && !isNaN(parsedCost)
              ? parsedCost
              : null,
        }
      );

      if (!res.ok) throw new Error(res.error || "Error al completar la tarea");

      const data = res.data as { blockedReason?: string | null };
      if (data?.blockedReason) {
        toast.warning(data.blockedReason, { duration: 6000 });
      } else {
        toast.success("Tarea completada correctamente");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al completar la tarea"
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[580px] max-h-[90vh] flex flex-col p-0"
        aria-describedby={undefined}
      >
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Completar Tarea y Entregar
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-5">
          {/* Task info banner */}
          <div className="bg-muted/30 p-3 rounded-md border border-dashed flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              <AlertCircle className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Tarea: {task.title}</p>
              <p className="text-[11px] text-muted-foreground">
                Al completar esta tarea, el flujo avanzará automáticamente al
                siguiente paso.
              </p>
            </div>
          </div>

          {/* ── A. Tiempo invertido ──────────────────────────────────── */}
          <div className="space-y-3 rounded-md border p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Tiempo invertido</span>
            </div>

            {/* Accumulated display */}
            <p className="text-xs text-muted-foreground">
              {(task.progress_minutes ?? 0) > 0
                ? `Tiempo acumulado previo: ${formatProgressMinutes(task.progress_minutes ?? 0)}`
                : "Sin tiempo registrado previo"}
            </p>

            {/* Input row */}
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="task-hours" className="text-xs">
                  Horas
                </Label>
                <Input
                  id="task-hours"
                  type="number"
                  min={0}
                  placeholder="0"
                  className="w-20 h-8 text-sm"
                  value={hoursInput}
                  onChange={(e) => setHoursInput(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="task-minutes" className="text-xs">
                  Minutos
                </Label>
                <Input
                  id="task-minutes"
                  type="number"
                  min={0}
                  max={59}
                  placeholder="0"
                  className="w-20 h-8 text-sm"
                  value={minutesInput}
                  onChange={(e) => setMinutesInput(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 shrink-0"
                onClick={handleAddTime}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar tiempo
              </Button>
            </div>

            {/* Running total */}
            <p className="text-sm font-medium text-primary">
              Total:{" "}
              {accumulatedMinutes > 0
                ? formatProgressMinutes(accumulatedMinutes)
                : "0 min"}
            </p>
          </div>

          {/* ── B. Enlace entregable ────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="task-delivery-url" className="text-sm font-semibold">
              Enlace entregable{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="task-delivery-url"
              type="url"
              placeholder="https://..."
              value={deliveryUrl}
              onChange={(e) => setDeliveryUrl(e.target.value)}
            />
          </div>

          {/* ── Notes ────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">
              Nota de Entregables / Resultados{" "}
              <span className="text-destructive">*</span>
            </label>
            <div className="min-h-[200px]">
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                placeholder="Describe aquí lo que se entrega, links relevantes, o cualquier nota importante para el siguiente paso..."
                expandable={true}
                title="Nota de entrega"
              />
            </div>
            <p className="text-[11px] text-muted-foreground italic">
              Esta nota quedará en el historial de la tarea para consulta
              futura.
            </p>
          </div>

          {/* ── C. Costo del trabajo (solo colaborador externo) ────── */}
          {isExternalCollaborator && (
            <div className="space-y-2 rounded-md border p-4 bg-amber-50/50 dark:bg-amber-900/10">
              <Label className="text-sm font-semibold">
                Costo del trabajo
              </Label>

              {isReadOnlyCost ? (
                <p className="text-sm text-muted-foreground">
                  {task.completion_cost != null
                    ? `Costo acordado: $${Number(task.completion_cost).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                    : "Costo definido por cotización"}
                </p>
              ) : (
                <>
                  <Input
                    id="task-completion-cost"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={completionCost}
                    onChange={(e) => setCompletionCost(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Ingresa el costo final del trabajo realizado.
                  </p>
                </>
              )}
            </div>
          )}
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
            disabled={isLoading || isHtmlEmpty(notes) || accumulatedMinutes === 0}
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
