"use client";

import { ProjectDetailType } from "@/lib/definitions";
import { CampaignSelect } from "./CampaignSelect";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { patch } from "@/lib/services/apiService";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, User, Package, Tag } from "lucide-react";

interface Props {
  project: ProjectDetailType;
  canEdit: boolean;
}

export function ProjectInfoTab({ project, canEdit }: Props) {
  const queryClient = useQueryClient();

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
