"use client";

import { useEffect } from "react";
import { FieldPath, useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientSelect } from "@/components/clients/ClientSelect";
import { ManagerSelect } from "./ManagerSelect";
import { get, post } from "@/lib/services/apiService";
import {
  BrandReassignment,
  ManagerTransferPreview,
  ManagerTransferResult,
  ProjectReassignment,
} from "@/lib/definitions";

/**
 * Traslado de un gerente a otro cliente.
 *
 * El gerente es SIEMPRE la misma fila en `managers`: trasladarlo no lo duplica.
 * Como `brands.client_id` / `projects.client_id` son columnas propias, sus
 * marcas y proyectos NO cambian de cliente solos: o se les asigna un sucesor
 * del cliente actual, o se van con el gerente al cliente destino.
 */

type TransferFormValues = {
  client_id: number | undefined;
  email: string;
  phone: string;
  started_at: string;
  reason: string;
  brand_reassignments: Record<string, number | undefined>;
  project_reassignments: Record<string, number | undefined>;
};

const EMPTY_VALUES: TransferFormValues = {
  client_id: undefined,
  email: "",
  phone: "",
  started_at: "",
  reason: "",
  brand_reassignments: {},
  project_reassignments: {},
};

/** Mensajes accionables por código de dominio devuelto por el endpoint. */
const ERROR_MESSAGES: Record<string, string> = {
  EMAIL_IN_USE:
    "Ese correo ya lo usa otro gerente. Los correos son únicos en todo el sistema: escribe uno distinto.",
  SAME_CLIENT:
    "El gerente ya pertenece a ese cliente. Elige un cliente destino diferente.",
  MANAGER_CLIENT_MISMATCH:
    "Alguno de los sucesores elegidos pertenece a otro cliente. Solo puedes dejar marcas y proyectos a gerentes del cliente actual.",
  CLIENT_NOT_FOUND: "El cliente destino ya no existe.",
  MANAGER_NOT_FOUND: "El gerente ya no existe.",
  BRAND_NOT_FOUND: "Una de las marcas a reasignar ya no existe.",
  PROJECT_NOT_FOUND: "Uno de los proyectos a reasignar ya no existe.",
};

/** Convierte `{ "12": 5, "13": undefined }` en la lista que espera el endpoint. */
function toReassignments<K extends "brand_id" | "project_id">(
  raw: Record<string, number | undefined>,
  key: K
): Array<Record<K | "new_manager_id", number>> {
  return Object.entries(raw ?? {})
    .filter(([, newManagerId]) => Boolean(newManagerId))
    .map(
      ([id, newManagerId]) =>
        ({
          [key]: Number(id),
          new_manager_id: Number(newManagerId),
        }) as Record<K | "new_manager_id", number>
    );
}

interface Props {
  managerId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: ManagerTransferResult) => void;
}

export function TransferManagerDialog({
  managerId,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const queryClient = useQueryClient();
  const { refresh } = useRouter();

  const form = useForm<TransferFormValues>({ defaultValues: EMPTY_VALUES });
  const {
    formState: { isSubmitting },
  } = form;

  const {
    data: preview,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["manager-transfer-preview", managerId],
    queryFn: async () => {
      const res = await get<ManagerTransferPreview>(
        `managers/${managerId}/transfer-preview`
      );
      if (!res.ok) throw new Error(res.error);
      return res.data as unknown as ManagerTransferPreview;
    },
    enabled: open,
  });

  // Al cerrar se descarta lo tecleado: reabrir siempre parte de cero.
  useEffect(() => {
    if (!open) form.reset(EMPTY_VALUES);
  }, [open, form]);

  const currentClientId = preview?.current_client?.id
    ? Number(preview.current_client.id)
    : preview?.manager?.client_id
      ? Number(preview.manager.client_id)
      : undefined;

  const brands = preview?.brands ?? [];
  const projects = preview?.projects ?? [];

  const brandAssignments = form.watch("brand_reassignments");
  const projectAssignments = form.watch("project_reassignments");

  const brandsMoving = brands.filter(
    (brand) => !brandAssignments?.[String(brand.id)]
  ).length;
  const projectsMoving = projects.filter(
    (project) => !projectAssignments?.[String(project.id)]
  ).length;

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!values.client_id) {
      form.setError("client_id", {
        type: "required",
        message: "Selecciona el cliente destino",
      });
      toast.error("Selecciona el cliente destino");
      return;
    }

    const brand_reassignments = toReassignments(
      values.brand_reassignments,
      "brand_id"
    ) as BrandReassignment[];
    const project_reassignments = toReassignments(
      values.project_reassignments,
      "project_id"
    ) as ProjectReassignment[];

    const email = values.email.trim();
    const phone = values.phone.trim();
    const reason = values.reason.trim();

    const res = await post<ManagerTransferResult>(
      `managers/${managerId}/transfer`,
      {
        target_client_id: values.client_id,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        // El endpoint espera un ISO con offset; el input es date-only.
        ...(values.started_at
          ? { started_at: new Date(`${values.started_at}T00:00:00`).toISOString() }
          : {}),
        ...(reason ? { reason } : {}),
        brand_reassignments,
        project_reassignments,
      }
    );

    if (!res.ok) {
      const code = (res.data as { code?: string } | undefined)?.code;
      toast.error(
        (code && ERROR_MESSAGES[code]) ||
          res.error ||
          "No se pudo trasladar el gerente"
      );
      return;
    }

    const result = res.data as unknown as ManagerTransferResult;

    toast.success(
      `Gerente trasladado. ${result.reassigned_brands} marca(s) y ${result.reassigned_projects} proyecto(s) reasignados.`
    );

    queryClient.invalidateQueries({ queryKey: ["manager-transfer-preview"] });
    queryClient.invalidateQueries({ queryKey: ["manager-history", managerId] });
    queryClient.invalidateQueries({ queryKey: ["managers"] });
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    queryClient.invalidateQueries({ queryKey: ["brands"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["project"] });

    onOpenChange(false);
    onSuccess?.(result);
    refresh();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        Sin overflow-y-auto en el propio DialogContent a propósito: este
        diálogo renderiza un ManagerSelect por CADA marca/proyecto del
        gerente (cantidad dinámica, puede ser larga), así que a diferencia
        de CreateBrandModal/CreateClientModal (contenido corto, se les quitó
        el recorte) aquí SÍ hace falta limitar la altura — pero el scroll
        vive en un div interno (`flex-1 overflow-y-auto`), no en
        DialogContent, con Header/Footer fuera de esa región (patrón ya
        usado en TaskCompleteDialog/TaskHistoryDialog/AdjustmentWizard).
        Los ManagerSelect/ClientSelect ya no portan ni usan
        menuPosition="fixed" (ver comentarios en ManagerSelect.tsx), así que
        su menú es un descendiente DOM normal — sigue el scroll del
        contenedor que lo alberga sin necesidad de portal.
      */}
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Trasladar a otro cliente</DialogTitle>
          <DialogDescription>
            El gerente conserva su historial. Sus marcas y proyectos se quedan en{" "}
            {preview?.current_client?.name ?? "el cliente actual"} salvo que los
            traslades con él.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && (
            <div className="space-y-3 py-2" data-testid="transfer-preview-loading">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {isError && (
            <p className="text-sm text-destructive py-4">
              No se pudo cargar la información del gerente.
            </p>
          )}

          {!isLoading && !isError && preview && (
            <Form {...form}>
              <form id="transfer-manager" onSubmit={handleSubmit} className="space-y-6">
                <ClientSelect
                  control={form.control}
                  name="client_id"
                  label="Cliente destino"
                  placeholder="Selecciona el nuevo cliente"
                  excludeClientId={currentClientId}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo corporativo nuevo</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder={preview.manager.email}
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Actual: {preview.manager.email}. Déjalo vacío para
                          conservarlo.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={preview.manager.phone || "Sin teléfono"}
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Déjalo vacío para conservar el actual.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="started_at"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de inicio</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Motivo</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={2}
                            placeholder="Opcional — queda en el historial"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {brands.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">
                      Marcas en {preview.current_client?.name ?? "el cliente actual"}
                    </h3>
                    {brands.map((brand) => (
                      <ManagerSelect
                        key={brand.id}
                        form={form}
                        control={form.control}
                        name={
                          `brand_reassignments.${brand.id}` as FieldPath<TransferFormValues>
                        }
                        label={brand.name}
                        placeholder="Sin sucesor — se traslada con el gerente"
                        clientId={currentClientId}
                        isClearable
                      />
                    ))}
                  </section>
                )}

                {projects.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">Proyectos activos</h3>
                    {projects.map((project) => (
                      <ManagerSelect
                        key={project.id}
                        form={form}
                        control={form.control}
                        name={
                          `project_reassignments.${project.id}` as FieldPath<TransferFormValues>
                        }
                        label={project.title}
                        placeholder="Sin sucesor — se traslada con el gerente"
                        clientId={currentClientId}
                        isClearable
                      />
                    ))}
                  </section>
                )}

                {(brandsMoving > 0 || projectsMoving > 0) && (
                  <p
                    className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200"
                    role="status"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      {brandsMoving} marca(s) y {projectsMoving} proyecto(s) sin
                      sucesor asignado se trasladarán junto al gerente al nuevo
                      cliente.
                    </span>
                  </p>
                )}
              </form>
            </Form>
          )}
        </div>

        {!isLoading && !isError && preview && (
          <DialogFooter className="p-6 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" form="transfer-manager" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
              )}
              Trasladar gerente
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default TransferManagerDialog;
