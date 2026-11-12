"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, BadgeDollarSign, Pencil } from "lucide-react";
import { patch } from "@/lib/services/apiService";
import { INVALID_COP_AMOUNT_MESSAGE, parseCopAmount } from "@/lib/utils/cop-amount";
import { formatMoney } from "@/lib/utils/format-money";
import type { ProjectDetailType } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  projectId: number;
  /** undefined: the role cannot see it; null: not recorded yet. */
  salePrice: number | null | undefined;
  canEdit: boolean;
}

/** Sale price in the project's main area; red until someone records it. */
export function ProjectSalePrice({ projectId, salePrice, canEdit }: Props) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (salePrice === undefined) return null;

  const isMissing = salePrice === null;

  const startEditing = () => {
    setDraft(salePrice != null ? String(salePrice) : "");
    setIsEditing(true);
  };

  const save = async () => {
    const value = parseCopAmount(draft);
    if (value === undefined) {
      toast.error(INVALID_COP_AMOUNT_MESSAGE);
      return;
    }
    setIsSaving(true);
    try {
      const res = await patch<{ sale_price: number | null }>(`projects/${projectId}/financials`, {
        sale_price: value,
      });
      if (!res.ok) throw new Error(res.error || "Error al guardar el precio de venta");
      queryClient.setQueryData<ProjectDetailType>(["project", projectId], (old) =>
        old ? { ...old, sale_price: value } : old
      );
      // The margin in the metrics depends on the sale price.
      await queryClient.invalidateQueries({ queryKey: ["project-financials", projectId] });
      toast.success("Precio de venta actualizado");
      setIsEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar el precio de venta");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      data-testid="project-sale-price"
      data-missing={isMissing ? "true" : "false"}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3",
        isMissing && "border-destructive bg-destructive/5"
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          isMissing ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
        )}
      >
        {isMissing ? <AlertCircle className="size-4" /> : <BadgeDollarSign className="size-4" />}
      </div>

      <div className="min-w-0 flex-1 leading-tight">
        <p className={cn("text-xs", isMissing ? "text-destructive" : "text-muted-foreground")}>
          {isMissing ? "Precio de venta sin registrar" : "Precio de venta"}
        </p>
        {isEditing ? (
          <form
            className="mt-1 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Input
              aria-label="Precio de venta del proyecto"
              inputMode="numeric"
              placeholder="Ej: 2.500.000"
              className="h-8 w-40"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
            <Button type="submit" size="sm" disabled={isSaving}>
              Guardar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
          </form>
        ) : isMissing ? (
          <p className="text-sm text-destructive/90">
            {canEdit
              ? "Anota en cuánto se vendió el proyecto."
              : "El comercial aún no ha registrado en cuánto se vendió."}
          </p>
        ) : (
          <p className="text-lg font-semibold tabular-nums" data-testid="sale-price-value">
            {formatMoney(salePrice)}
          </p>
        )}
      </div>

      {canEdit && !isEditing && (
        isMissing ? (
          <Button size="sm" variant="destructive" onClick={startEditing}>
            Registrar precio de venta
          </Button>
        ) : (
          <Button size="icon" variant="ghost" aria-label="Editar precio de venta" onClick={startEditing}>
            <Pencil />
          </Button>
        )
      )}
    </div>
  );
}
