"use client";

import { useEffect, useMemo, useState } from "react";
import { ProjectDetailType } from "@/lib/definitions";
import { CampaignSelect } from "./CampaignSelect";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { patch } from "@/lib/services/apiService";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, User, Package, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatProjectDateTimeForDisplay,
  formatProjectDateTimeForInput,
  normalizeOptionalProjectText,
  normalizeProjectDateTime,
} from "@/lib/utils/project-date-time";

interface Props {
  project: ProjectDetailType;
  canEdit: boolean;
}

export function ProjectInfoTab({ project, canEdit }: Props) {
  const queryClient = useQueryClient();
  const initialMetadata = useMemo(
    () => ({
      ideal_delivery_at: formatProjectDateTimeForInput(project.ideal_delivery_at),
      oc: project.oc ?? "",
      billing_closed_at: formatProjectDateTimeForInput(project.billing_closed_at),
    }),
    [project.billing_closed_at, project.ideal_delivery_at, project.oc]
  );
  const [metadata, setMetadata] = useState(initialMetadata);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);

  useEffect(() => {
    setMetadata(initialMetadata);
  }, [initialMetadata]);

  const handleCampaignChange = async (id: number | null, name?: string) => {
    try {
      const res = await patch(`projects/${project.id}`, { campaign_id: id ?? null });
      if (!res.ok) throw new Error(res.error);
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(id ? `Campaña "${name}" asociada` : "Campaña desvinculada");
    } catch {
      toast.error("Error al actualizar la campaña");
    }
  };

  const createdAt = project.created_at
    ? format(new Date(project.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })
    : "—";

  const updatedAt = project.updated_at
    ? format(new Date(project.updated_at), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })
    : "—";

  const hasMetadataChanges =
    metadata.ideal_delivery_at !== initialMetadata.ideal_delivery_at ||
    metadata.oc !== initialMetadata.oc ||
    metadata.billing_closed_at !== initialMetadata.billing_closed_at;

  const handleMetadataChange = (
    field: "ideal_delivery_at" | "oc" | "billing_closed_at",
    value: string
  ) => {
    setMetadata((current) => ({ ...current, [field]: value }));
  };

  const handleMetadataReset = () => {
    setMetadata(initialMetadata);
  };

  const handleMetadataSave = async () => {
    try {
      setIsSavingMetadata(true);
      const res = await patch(`projects/${project.id}`, {
        ideal_delivery_at: metadata.ideal_delivery_at
          ? normalizeProjectDateTime(metadata.ideal_delivery_at)
          : null,
        oc: normalizeOptionalProjectText(metadata.oc),
        billing_closed_at: metadata.billing_closed_at
          ? normalizeProjectDateTime(metadata.billing_closed_at)
          : null,
      });

      if (!res.ok) throw new Error(res.error);

      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Información del proyecto actualizada");
    } catch {
      toast.error("Error al actualizar la información del proyecto");
    } finally {
      setIsSavingMetadata(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      {/* Campaign */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" />
          Campaña asociada
        </label>
        {canEdit ? (
          <CampaignSelect
            value={project.campaign_id}
            initialLabel={project.campaign_name}
            clientId={project.client_id}
            onChange={handleCampaignChange}
            placeholder="Sin campaña — buscar o crear..."
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {project.campaign_name ?? "Sin campaña"}
          </p>
        )}
      </div>

      {/* Product */}
      <div className="space-y-1">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5" />
          Producto
        </p>
        <p className="text-sm text-muted-foreground">
          {project.product_name ?? "Sin producto"}
        </p>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-foreground">Metadatos del proyecto</h3>
          <p className="text-xs text-muted-foreground">
            El cierre de facturación es administrativo y se mantiene separado de la finalización del proyecto.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-ideal-delivery">Fecha ideal de entrega</Label>
          {canEdit ? (
            <Input
              id="project-ideal-delivery"
              type="datetime-local"
              value={metadata.ideal_delivery_at}
              onChange={(event) => handleMetadataChange("ideal_delivery_at", event.target.value)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {formatProjectDateTimeForDisplay(project.ideal_delivery_at) ?? "Sin definir"}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-oc">OC</Label>
          {canEdit ? (
            <Input
              id="project-oc"
              value={metadata.oc}
              onChange={(event) => handleMetadataChange("oc", event.target.value)}
              placeholder="Sin OC"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{project.oc ?? "Sin OC"}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-billing-closed-at">Cierre de facturación</Label>
          {canEdit ? (
            <Input
              id="project-billing-closed-at"
              type="datetime-local"
              value={metadata.billing_closed_at}
              onChange={(event) => handleMetadataChange("billing_closed_at", event.target.value)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {formatProjectDateTimeForDisplay(project.billing_closed_at) ?? "Sin cierre de facturación"}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Corresponde al cierre administrativo/facturación, no a <code>completed_at</code>.
          </p>
        </div>

        {canEdit && (
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleMetadataReset}
              disabled={isSavingMetadata || !hasMetadataChanges}
            >
              Restablecer
            </Button>
            <Button
              type="button"
              onClick={handleMetadataSave}
              disabled={isSavingMetadata || !hasMetadataChanges}
            >
              {isSavingMetadata ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-2 text-sm text-muted-foreground border-t pt-4">
        {project.created_by_name && (
          <p className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 shrink-0" />
            Creado por{" "}
            <span className="text-foreground font-medium">{project.created_by_name}</span>
          </p>
        )}
        <p className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          Creado el {createdAt}
        </p>
        <p className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          Última actualización: {updatedAt}
        </p>
      </div>
    </div>
  );
}
