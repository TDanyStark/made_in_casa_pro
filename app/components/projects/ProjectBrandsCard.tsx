"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Tags } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AdditionalBrandsSelect } from "@/components/brands/AdditionalBrandsSelect";
import { patch } from "@/lib/services/apiService";
import { ProjectBrandRef, ProjectDetailType } from "@/lib/definitions";

const sameIds = (a: ProjectBrandRef[], b: ProjectBrandRef[]) =>
  a.length === b.length && a.every((brand, i) => brand.id === b[i].id);

/**
 * Marca principal (fija) + marcas asociadas editables del proyecto.
 * El PATCH envía el conjunto completo; el backend valida mismo cliente.
 */
export function ProjectBrandsCard({
  project,
  canEdit,
}: {
  project: ProjectDetailType;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const saved = project.additional_brands ?? [];
  const [selected, setSelected] = useState<ProjectBrandRef[]>(saved);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelected(project.additional_brands ?? []);
  }, [project.additional_brands]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await patch(`projects/${project.id}`, {
        additional_brand_ids: selected.map((brand) => brand.id),
      });
      if (!res.ok) throw new Error(res.error || "Error al actualizar las marcas");

      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Marcas asociadas actualizadas");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar las marcas");
      setSelected(saved);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-4 max-w-lg">
      <div className="space-y-1">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Tags className="h-3.5 w-3.5" />
          Marcas
        </h3>
        <p className="text-xs text-muted-foreground">
          Principal: <span className="font-medium text-foreground">{project.brand_name}</span>.
          Las marcas asociadas deben ser de {project.client_name}.
        </p>
      </div>

      {canEdit ? (
        <div className="space-y-3">
          <AdditionalBrandsSelect
            clientId={project.client_id}
            excludeBrandId={project.brand_id}
            value={selected}
            onChange={setSelected}
            disabled={isSaving}
          />
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || sameIds(selected, saved)}
          >
            {isSaving && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
            Guardar marcas
          </Button>
        </div>
      ) : saved.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin marcas asociadas</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {saved.map((brand) => (
            <li key={brand.id} className="text-xs px-2 py-0.5 rounded-full bg-muted">
              {brand.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ProjectBrandsCard;
