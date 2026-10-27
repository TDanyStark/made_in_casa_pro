"use client";

import { UserCog } from "lucide-react";

import { ProjectDetailType } from "@/lib/definitions";

/**
 * Gerente y cliente del proyecto: los actuales (de la marca principal) y los
 * de la creación.
 *
 * Solo lectura: el gerente de un proyecto es siempre el de su marca principal
 * y se cambia reasignando la marca (ver `updateBrand`).
 */
export function ProjectManagerCard({
  project,
}: {
  project: ProjectDetailType;
}) {
  const currentManager = project.current_client_name
    ? `${project.manager_name} (${project.current_client_name})`
    : project.manager_name;

  return (
    <div className="space-y-1 rounded-lg border p-4 max-w-lg">
      <h3 className="text-sm font-medium flex items-center gap-1.5">
        <UserCog className="h-3.5 w-3.5" />
        Gerente principal
      </h3>
      <p className="text-sm">{currentManager}</p>
      {project.created_manager_name && (
        <p className="text-xs text-muted-foreground">
          {`Al crearse: ${project.created_manager_name} (${project.client_name})`}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {`Para cambiar el gerente, reasigna la marca ${project.brand_name} a otro gerente.`}
      </p>
    </div>
  );
}

export default ProjectManagerCard;
