"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { debounce } from "lodash";
import Select from "react-select";
import { get } from "@/lib/services/apiService";
import { BrandsAndManagersType, ApiResponseWithPagination } from "@/lib/definitions";
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
import { WizardState } from "@/hooks/useProjectWizard";

const schema = z.object({
  title: z.string().min(1, "El título es requerido").max(300),
  brand_id: z.number({ required_error: "La marca es requerida" }).int().positive(),
});

type FormValues = z.infer<typeof schema>;

interface BrandOption {
  value: number;
  label: string;
  clientName?: string;
}

interface Props {
  state: WizardState;
  onNext: (data: Partial<WizardState>) => void;
}

export function WizardStep1Basics({ state, onNext }: Props) {
  const [search, setSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<BrandOption | null>(
    state.brand_id ? { value: state.brand_id, label: state.brand_name } : null
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: state.title,
      brand_id: state.brand_id ?? undefined,
    },
  });

  const { data: brandsData, isLoading } = useQuery({
    queryKey: ["brands-search", search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "30" });
      if (search) params.set("search", search);
      const res = await get<ApiResponseWithPagination<BrandsAndManagersType[]>>(`brands?${params}`);
      if (!res.ok || !res.data) return [];
      return ((res.data as unknown as { data: BrandsAndManagersType[] }).data ?? []).map(
        (b): BrandOption => ({
          value: b.id,
          label: b.brand_name,
          clientName: b.manager_name,
        })
      );
    },
    staleTime: 1000 * 30,
  });

  // Also fetch client info when brand selected
  const { data: brandDetail } = useQuery({
    queryKey: ["brand-detail", selectedBrand?.value],
    queryFn: async () => {
      if (!selectedBrand?.value) return null;
      const res = await get<{ client_name: string }>(`brands/${selectedBrand.value}`);
      return res.ok ? res.data : null;
    },
    enabled: !!selectedBrand?.value,
  });

  const debouncedSearch = debounce((v: string) => setSearch(v), 400);

  const onSubmit = (values: FormValues) => {
    const brand = brandsData?.find((b) => b.value === values.brand_id);
    const clientName =
      (brandDetail as unknown as { client_name?: string } | null)?.client_name ?? "";
    onNext({
      title: values.title,
      brand_id: values.brand_id,
      brand_name: brand?.label ?? state.brand_name,
      client_name: clientName,
    });
  };

  useEffect(() => {
    if (selectedBrand) form.setValue("brand_id", selectedBrand.value);
  }, [selectedBrand, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

        <FormField
          control={form.control}
          name="brand_id"
          render={() => (
            <FormItem>
              <FormLabel>Marca</FormLabel>
              <FormControl>
                <Select<BrandOption>
                  options={brandsData ?? []}
                  value={selectedBrand}
                  onChange={(opt) => {
                    setSelectedBrand(opt as BrandOption | null);
                    form.setValue("brand_id", (opt as BrandOption | null)?.value ?? (undefined as unknown as number));
                    form.clearErrors("brand_id");
                  }}
                  onInputChange={(v) => debouncedSearch(v)}
                  isLoading={isLoading}
                  placeholder="Buscar marca..."
                  noOptionsMessage={({ inputValue }) =>
                    inputValue ? "Sin resultados" : "Escribe para buscar"
                  }
                  loadingMessage={() => "Cargando..."}
                  formatOptionLabel={(opt: BrandOption) => (
                    <div className="flex items-center justify-between">
                      <span>{opt.label}</span>
                      {opt.clientName && (
                        <span className="text-xs text-muted-foreground">{opt.clientName}</span>
                      )}
                    </div>
                  )}
                  classNamePrefix="react-select"
                  filterOption={() => true}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit">Siguiente</Button>
        </div>
      </form>
    </Form>
  );
}
