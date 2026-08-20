"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { ProjectDrivePermissionsResponse } from "@/lib/definitions";
import { del, get, post } from "@/lib/services/apiService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const SOURCE_LABELS = {
  leadership: "Liderazgo",
  creator: "Creador",
  task_assignee: "Responsable de tarea",
  manager: "Contacto cliente",
  co_manager: "Contacto cliente",
} as const;

function missingReason(failureCode: string | null) {
  if (failureCode === "NO_GOOGLE_ACCOUNT") {
    return "Google indicó que este correo no está asociado a una cuenta de Google.";
  }
  if (failureCode === "POLICY_OR_RESTRICTION") {
    return "Google rechazó el acceso por una política o restricción de uso compartido.";
  }
  return "No aparece con acceso en Drive.";
}

export function ProjectDriveAccessManager({ projectId, canEdit }: { projectId: number; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const queryKey = ["project-drive-permissions", projectId];
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"reader" | "writer">("writer");
  const permissionsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await get<ProjectDrivePermissionsResponse>(`projects/${projectId}/drive/permissions`);
      if (!response.ok || !response.data) throw new Error(response.error ?? "No se pudo consultar Drive");
      return response.data;
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const addMutation = useMutation({
    mutationFn: async () => {
      const response = await post(`projects/${projectId}/drive/permissions`, { email, role });
      if (!response.ok) throw new Error(response.error);
    },
    onSuccess: () => {
      setEmail("");
      refresh();
      toast.success("Acceso de Drive agregado");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo agregar el acceso"),
  });
  const deleteMutation = useMutation({
    mutationFn: async (permissionId: string) => {
      const response = await del(`projects/${projectId}/drive/permissions`, { permissionId });
      if (!response.ok) throw new Error(response.error);
    },
    onSuccess: () => {
      refresh();
      toast.success("Acceso directo eliminado");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo quitar el acceso"),
  });

  if (permissionsQuery.isLoading) return <p className="text-sm text-muted-foreground">Consultando accesos...</p>;
  if (permissionsQuery.isError) {
    return <p className="text-sm text-destructive">{permissionsQuery.error.message}</p>;
  }

  const data = permissionsQuery.data!;
  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-medium">Acceso a la carpeta</h4>
        <p className="text-xs text-muted-foreground">
          Google Drive es la fuente de verdad. Los accesos por grupo, dominio o enlace pueden no identificar a cada persona.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {data.permissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No se encontraron permisos visibles.</p>
        ) : data.permissions.map((permission) => (
          <div key={permission.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {permission.emailAddress ?? permission.displayName ?? permission.domain ?? permission.type}
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                <Badge variant="secondary">{permission.role}</Badge>
                {permission.type !== "user" && <Badge variant="outline">{permission.type}</Badge>}
                {permission.inherited && <Badge variant="outline">heredado</Badge>}
              </div>
            </div>
            {canEdit && permission.canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Quitar acceso de ${permission.emailAddress ?? permission.displayName ?? permission.type}`}>
                    <Trash2 />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Quitar acceso directo</AlertDialogTitle>
                    <AlertDialogDescription>Esta acción elimina el permiso directo de Google Drive.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate(permission.id)}>Quitar acceso</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        ))}
      </div>

      {canEdit && data.expectedRecipients && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-medium">Personas que deberían tener acceso</h4>
            <p className="text-xs text-muted-foreground">
              El rol automático esperado es editor. La sincronización agrega accesos y no revoca permisos existentes.
            </p>
          </div>
          {data.expectedRecipients.map((recipient) => (
            <div
              key={recipient.email}
              className={cn(
                "flex flex-col gap-2 rounded-md border px-3 py-2",
                recipient.status === "missing" && "border-destructive bg-destructive/5 text-destructive",
                recipient.status === "insufficient_role" && "border-amber-500/60 bg-amber-500/10"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  {recipient.name && <p className="truncate text-sm font-medium">{recipient.name}</p>}
                  <p className="truncate text-sm">{recipient.email}</p>
                </div>
                <Badge variant={recipient.status === "missing" ? "destructive" : "secondary"}>
                  {recipient.status === "has_access"
                    ? "Acceso confirmado"
                    : recipient.status === "insufficient_role"
                      ? "Rol insuficiente"
                      : "Sin acceso visible"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {[...new Set(recipient.sources.map((source) => SOURCE_LABELS[source]))].map((label) => (
                  <Badge key={label} variant="outline">{label}</Badge>
                ))}
                {recipient.accessVia && recipient.accessVia !== "direct" && (
                  <Badge variant="outline">por {recipient.accessVia === "domain" ? "dominio" : "enlace"}</Badge>
                )}
              </div>
              {recipient.status === "missing" && (
                <div className="flex flex-col gap-1 text-xs">
                  <p>{missingReason(recipient.failureCode)}</p>
                  {recipient.failureCode !== "NO_GOOGLE_ACCOUNT" && recipient.failureCode !== "POLICY_OR_RESTRICTION" && (
                    <p>
                      Las políticas de uso compartido o la pertenencia a grupos pueden afectar esta verificación; Drive no permite confirmar cada miembro de un grupo.
                    </p>
                  )}
                  {recipient.hasUnverifiableGroupAccess &&
                    (recipient.failureCode === "NO_GOOGLE_ACCOUNT" || recipient.failureCode === "POLICY_OR_RESTRICTION") && (
                      <p>Drive no permite confirmar si este correo recibe acceso mediante alguno de los grupos visibles.</p>
                    )}
                </div>
              )}
              {recipient.status === "insufficient_role" && (
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Tiene acceso, pero con el rol {recipient.actualRole ?? "desconocido"}; se esperaba editor.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && data.canShare && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="project-drive-access-email">Agregar correo</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="project-drive-access-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="persona@empresa.com"
            />
            <Select value={role} onValueChange={(value) => setRole(value as "reader" | "writer")}>
              <SelectTrigger className="sm:w-40" aria-label="Rol de acceso">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="writer">Editor</SelectItem>
                  <SelectItem value="reader">Lector</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button type="button" disabled={!email.trim() || addMutation.isPending} onClick={() => addMutation.mutate()}>
              {addMutation.isPending ? "Agregando..." : "Agregar"}
            </Button>
          </div>
        </div>
      )}
      {canEdit && !data.canShare && (
        <p className="text-sm text-muted-foreground">La cuenta de Google conectada puede ver esta carpeta, pero no administrar sus accesos.</p>
      )}
    </div>
  );
}
