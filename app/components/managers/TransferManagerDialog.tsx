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
} from "@/lib/definitions";

/**
 * Traslado de un gerente a otro cliente.
 *
 * El gerente es SIEMPRE la misma fila en `managers`: trasladarlo no lo duplica.
 * Las marcas nunca cambian de cliente: cada marca necesita un nuevo gerente del
 * cliente actual antes del traslado, y los proyectos pasan siempre al nuevo
 * gerente de su marca principal (se listan solo como información).
 */

type TransferFormValues = {
  client_id: number | undefined;
  email: string;
  phone: string;
  started_at: string;
  reason: string;
  brand_reassignments: Record<string, number | undefined>;
};

const EMPTY_VALUES: TransferFormValues = {
  client_id: undefined,
  email: "",
  phone: "",
  started_at: "",
  reason: "",
  brand_reassignments: {},
};

/** Mensajes accionables por código de dominio devuelto por el endpoint. */
const ERROR_MESSAGES: Record<string, string> = {
  EMAIL_IN_USE:
    "Ese correo ya lo usa otro gerente. Los correos son únicos en todo el sistema: escribe uno distinto.",
  SAME_CLIENT:
    "El gerente ya pertenece a ese cliente. Elige un cliente destino diferente.",
  MANAGER_CLIENT_MISMATCH:
    "Alguno de los sucesores elegidos pertenece a otro cliente. Solo puedes dejar marcas a gerentes del cliente actual.",
  CLIENT_NOT_FOUND: "El cliente destino ya no existe.",
  MANAGER_NOT_FOUND: "El gerente ya no existe.",
  BRAND_NOT_FOUND: "Una de las marcas a reasignar ya no existe.",
};

/** Convierte `{ "12": 5, "13": undefined }` en la lista que espera el endpoint. */
function toBrandReassignments(
  raw: Record<string, number | undefined>
): BrandReassignment[] {
  return Object.entries(raw ?? {})
    .filter(([, newManagerId]) => Boolean(newManagerId))
    .map(([id, newManagerId]) => ({
      brand_id: Number(id),
      new_manager_id: Number(newManagerId),
    }));
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

  const brandsWithoutSuccessor = brands.filter(
    (brand) => !brandAssignments?.[String(brand.id)]
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!values.client_id) {
      form.setError("client_id", {
        type: "required",
        message: "Selecciona el cliente destino",
      });
      toast.error("Selecciona el cliente destino");
      return;
    }

    // Las marcas nunca cambian de cliente: ninguna puede quedarse con el
    // gerente que se va (el endpoint lo rechaza igual con 400).
    const missingBrands = brands.filter(
      (brand) => !values.brand_reassignments?.[String(brand.id)]
    );
    if (missingBrands.length > 0) {
      for (const brand of missingBrands) {
        form.setError(
          `brand_reassignments.${brand.id}` as FieldPath<TransferFormValues>,
          { type: "required", message: "Asigna el nuevo gerente de esta marca" }
        );
      }
      toast.error(
        `Asigna un nuevo gerente a todas las marcas antes del traslado: ${missingBrands
          .map((brand) => brand.name)
          .join(", ")}`
      );
      return;
    }

    const brand_reassignments = toBrandReassignments(values.brand_reassignments);

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
      `Gerente trasladado. ${result.reassigned_brands} marca(s) reasignada(s); ${result.followed_projects} proyecto(s) siguieron al nuevo gerente de su marca.`
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
        diálogo renderiza un ManagerSelect por CADA marca del gerente y la
        lista de sus proyectos (cantidad dinámica, puede ser larga), así que a diferencia
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
            {preview?.current_client?.name ?? "el cliente actual"}: cada marca
            necesita un nuevo gerente y sus proyectos pasan al nuevo gerente de
            su marca.
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
                        placeholder="Selecciona el nuevo gerente de la marca"
                        clientId={currentClientId}
                        isClearable
                      />
                    ))}
                  </section>
                )}

                {projects.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Proyectos activos</h3>
                    <ul className="space-y-1 text-sm">
                      {projects.map((project) => (
                        <li key={project.id} className="flex justify-between gap-2">
                          <span>{project.title}</span>
                          {project.brand_name && (
                            <span className="text-xs text-muted-foreground">
                              {`Marca: ${project.brand_name}`}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground" role="note">
                      {`Los proyectos pasan al nuevo gerente de su marca principal (${projects.length} proyecto(s)).`}
                    </p>
                  </section>
                )}

                {brandsWithoutSuccessor.length > 0 && (
                  <p
                    className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200"
                    role="status"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      {`${brandsWithoutSuccessor.length} marca(s) sin nuevo gerente. Asigna uno a cada marca: las marcas se quedan en ${preview.current_client?.name ?? "el cliente actual"}.`}
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
