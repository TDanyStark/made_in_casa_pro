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
