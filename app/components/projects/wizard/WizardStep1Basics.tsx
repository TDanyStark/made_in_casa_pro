"use client";

import { useState } from "react";
import { useForm, Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import { BrandSelect } from "@/components/brands/BrandSelect";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { User, Building2, Loader2 } from "lucide-react";
import { WizardState } from "@/hooks/useProjectWizard";
import { isSupportedProjectDateTime } from "@/lib/utils/project-date-time";

const schema = z.object({
  title: z.string().min(1, "El título es requerido").max(300),
  brand_id: z.number({ required_error: "La marca es requerida" }).int().positive(),
  ideal_delivery_at: z.string().trim().optional().refine(
    (value) => !value || isSupportedProjectDateTime(value),
    "Ingresa una fecha y hora válida"
  ),
  oc: z.string().optional(),
  billing_closed_at: z.string().trim().optional().refine(
    (value) => !value || isSupportedProjectDateTime(value),
    "Ingresa una fecha y hora válida"
  ),
});

type FormValues = z.infer<typeof schema>;

interface BrandOption {
  value: number;
  label: string;
}

// Full brand detail returned by GET /api/brands/[id]
interface BrandDetail {
  id: number;
  name: string;
  manager_id: number;
  manager: {
    id: number;
    name: string;
    email: string;
    client_id: number;
    client_info: {
      id: number;
      name: string;
    };
  };
}

interface Props {
  state: WizardState;
  onNext: (data: Partial<WizardState>) => void;
}

export function WizardStep1Basics({ state, onNext }: Props) {
  const [selectedBrand, setSelectedBrand] = useState<BrandOption | null>(
    state.brand_id ? { value: state.brand_id, label: state.brand_name } : null
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: state.title,
      brand_id: state.brand_id ?? undefined,
      ideal_delivery_at: state.ideal_delivery_at,
      oc: state.oc,
      billing_closed_at: state.billing_closed_at,
    },
  });

  // Full brand detail — auto-resolves manager + client when a brand is selected
  const { data: brandDetail, isLoading: isLoadingDetail } = useQuery<BrandDetail | null>({
    queryKey: ["brand-detail", selectedBrand?.value],
    queryFn: async () => {
      if (!selectedBrand?.value) return null;
      const res = await get<BrandDetail>(`brands/${selectedBrand.value}`);
      return res.ok ? (res.data as unknown as BrandDetail) : null;
    },
    enabled: !!selectedBrand?.value,
    staleTime: 1000 * 60,
  });

  // BrandSelect maneja su propia búsqueda y escribe brand_id en el form.
  // Aquí solo sincronizamos selectedBrand para disparar la resolución de
  // manager/cliente (query "brand-detail").
  const handleBrandChange = (value: number | undefined) => {
    if (!value) {
      setSelectedBrand(null);
    } else {
      setSelectedBrand({ value, label: "" });
    }
    form.clearErrors("brand_id");
  };

  const onSubmit = (values: FormValues) => {
    if (!brandDetail) return; // shouldn't happen — button is disabled while loading

    onNext({
      title: values.title,
      brand_id: values.brand_id,
      brand_name: brandDetail.name,
      client_id: brandDetail.manager?.client_info?.id ?? null,
      client_name: brandDetail.manager?.client_info?.name ?? "",
      manager_id: brandDetail.manager_id,
      manager_name: brandDetail.manager?.name ?? "",
      manager_email: brandDetail.manager?.email ?? "",
      ideal_delivery_at: values.ideal_delivery_at ?? "",
      oc: values.oc ?? "",
      billing_closed_at: values.billing_closed_at ?? "",
    });
  };

  const isLoadingBrandInfo = !!selectedBrand?.value && isLoadingDetail;
  const canProceed = !!brandDetail && !isLoadingDetail;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Title */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título del proyecto</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ej: Lanzamiento Digital Q1 2025"
                  {...field}
                  autoFocus
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Brand select — permite buscar y crear una marca inline */}
        <BrandSelect
          form={form}
          control={form.control as unknown as Control<{ brand_id: number; name: string; id?: number }>}
          name="brand_id"
          label="Marca"
          placeholder="Buscar o crear marca..."
          onChange={handleBrandChange}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="ideal_delivery_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha ideal de entrega</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="oc"
            render={({ field }) => (
              <FormItem>
                <FormLabel>OC</FormLabel>
                <FormControl>
                  <Input placeholder="Opcional" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="billing_closed_at"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cierre de facturación</FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} value={field.value ?? ""} />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Este dato es administrativo y no reemplaza la fecha de finalización operativa.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Auto-resolved info card — shows manager + client once brand is selected */}
        {selectedBrand && (
          <div className="min-h-[88px]">
            {isLoadingBrandInfo ? (
              <Card className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Cargando información de la marca...
              </Card>
            ) : brandDetail ? (
              <Card className="p-4 space-y-2 bg-muted/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Asignado automáticamente
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{brandDetail.manager?.name}</span>
                  {brandDetail.manager?.email && (
                    <span className="text-muted-foreground text-xs">
                      — {brandDetail.manager.email}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    {brandDetail.manager?.client_info?.name ?? "Sin cliente"}
                  </span>
                </div>
              </Card>
            ) : null}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={!!selectedBrand && !canProceed}>
            {isLoadingBrandInfo ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cargando...
              </>
            ) : (
              "Siguiente"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
