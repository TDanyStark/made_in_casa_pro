"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { patch, post } from "@/lib/services/apiService";
import { INVALID_COP_AMOUNT_MESSAGE, parseCopAmount } from "@/lib/utils/cop-amount";
import { PROJECT_COST_VERSION_REQUIRED_MESSAGE, type ProjectCostType } from "@/lib/definitions";
import type { ProjectVersion } from "@/lib/queries/projectFinancials";
import { projectCostsKey, useCostCategories, useVersionTasks } from "@/hooks/useProjectCosts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CostCategoryCombobox, type CostCategoryOption } from "./CostCategoryCombobox";

// Spec: odd/tasks/project-costs.md — S3 (optional task), S5 (version only with 2+), S6 (category).

const NO_TASK = "none";
const CATEGORY_REQUIRED_MESSAGE = "Selecciona una categoría";
const AMOUNT_POSITIVE_MESSAGE = "El monto debe ser mayor que 0";
const DATE_REQUIRED_MESSAGE = "Selecciona la fecha del costo";

/** Local YYYY-MM-DD (not UTC, so late evenings still count as today). */
function todayIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface Props {
  projectId: number;
  versions: ProjectVersion[];
  /** Cost to edit; null to create a new one. */
  cost: ProjectCostType | null;
  /** Version preselected for a new cost (the active filter). */
  defaultAdjustmentId: number | null;
  onClose: () => void;
}

export function ProjectCostDialog({ projectId, versions, cost, defaultAdjustmentId, onClose }: Props) {
  const queryClient = useQueryClient();
  const asksVersion = versions.length >= 2;

  const [category, setCategory] = useState<CostCategoryOption | null>(
    cost ? { id: cost.category_id, name: cost.category_name } : null
  );
  const [description, setDescription] = useState(cost?.description ?? "");
  const [amount, setAmount] = useState(cost ? String(cost.amount) : "");
  const [date, setDate] = useState(cost?.incurred_at ?? todayIso());
  const [adjustmentId, setAdjustmentId] = useState<number | null>(cost?.adjustment_id ?? defaultAdjustmentId);
  const [taskId, setTaskId] = useState<number | null>(cost?.task_id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // With one version the cost always belongs to it (S5).
  const effectiveVersion = asksVersion ? adjustmentId : (versions[0]?.id ?? null);
  const { data: categories = [] } = useCostCategories();
  const { data: tasks = [] } = useVersionTasks(projectId, effectiveVersion);

  const changeVersion = (value: string) => {
    setAdjustmentId(Number(value));
    // A linked task must belong to the cost's version.
    setTaskId(null);
  };

  const validate = (): string | Record<string, unknown> => {
    if (!category) return CATEGORY_REQUIRED_MESSAGE;
    const value = parseCopAmount(amount);
    if (value === undefined) return INVALID_COP_AMOUNT_MESSAGE;
    if (value === null || value <= 0) return AMOUNT_POSITIVE_MESSAGE;
    if (!date) return DATE_REQUIRED_MESSAGE;
    if (asksVersion && adjustmentId === null) return PROJECT_COST_VERSION_REQUIRED_MESSAGE;
    const trimmed = description.trim();
    return {
      category_id: category.id,
      description: trimmed === "" ? null : trimmed,
      amount: value,
      incurred_at: date,
      task_id: taskId,
      ...(asksVersion ? { adjustment_id: adjustmentId } : {}),
    };
  };

  const save = async () => {
    const payload = validate();
    if (typeof payload === "string") {
      setError(payload);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = cost
        ? await patch<ProjectCostType>(`projects/${projectId}/costs/${cost.id}`, payload)
        : await post<ProjectCostType>(`projects/${projectId}/costs`, payload);
      if (!res.ok) throw new Error(res.error || "Error al guardar el costo");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectCostsKey(projectId) }),
        queryClient.invalidateQueries({ queryKey: ["project-financials", projectId] }),
      ]);
      toast.success(cost ? "Costo actualizado" : "Costo agregado");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el costo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cost ? "Editar costo" : "Agregar costo"}</DialogTitle>
          <DialogDescription>
            Cobros asociados al proyecto que no son costo de tareas: pago al comercial, herramientas, créditos, etc.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="cost-category">Categoría</Label>
            <CostCategoryCombobox
              id="cost-category"
              categories={categories}
              value={category}
              onChange={setCategory}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost-description">Descripción</Label>
            <Textarea
              id="cost-description"
              placeholder="Ej: Tokens de ChatGPT para el guion"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cost-amount">Monto</Label>
              <Input
                id="cost-amount"
                inputMode="numeric"
                placeholder="Ej: 150.000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost-date">Fecha</Label>
              <Input
                id="cost-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          {asksVersion && (
            <div className="space-y-2">
              <Label htmlFor="cost-version">Versión</Label>
              <Select
                value={adjustmentId === null ? undefined : String(adjustmentId)}
                onValueChange={changeVersion}
                disabled={saving}
              >
                <SelectTrigger id="cost-version" className="w-full" aria-label="Versión">
                  <SelectValue placeholder="Seleccionar versión" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {`Versión ${v.version_number}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cost-task">Tarea vinculada (opcional)</Label>
            <Select
              value={taskId === null ? NO_TASK : String(taskId)}
              onValueChange={(v) => setTaskId(v === NO_TASK ? null : Number(v))}
              disabled={saving || effectiveVersion === null}
            >
              <SelectTrigger id="cost-task" className="w-full" aria-label="Tarea vinculada">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TASK}>Sin tarea</SelectItem>
                {tasks.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
