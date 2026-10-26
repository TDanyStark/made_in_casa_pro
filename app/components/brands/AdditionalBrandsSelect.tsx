"use client";

import { useMemo } from "react";
import Select from "react-select";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";
import { useGetEndpointQueryClient } from "@/hooks/useGetEndpointQueryClient";
import { BrandsAndManagersType, ProjectBrandRef } from "@/lib/definitions";

interface Option {
  value: number;
  label: string;
}

interface AdditionalBrandsSelectProps {
  /** Solo se ofrecen marcas de este cliente (regla "mismo cliente") */
  clientId: number;
  /** Marca principal del proyecto: nunca se ofrece como adicional */
  excludeBrandId: number;
  value: ProjectBrandRef[];
  onChange: (brands: ProjectBrandRef[]) => void;
  disabled?: boolean;
  inputId?: string;
}

/**
 * Selector múltiple de marcas asociadas a un proyecto. La marca principal
 * (`projects.brand_id`) se elige aparte con `BrandSelect`.
 */
export function AdditionalBrandsSelect({
  clientId,
  excludeBrandId,
  value,
  onChange,
  disabled = false,
  inputId,
}: AdditionalBrandsSelectProps) {
  const { searchTerm, handleInputChange, resetSearch } = useDebouncedSearch();

  const { data, isLoading, isError } = useGetEndpointQueryClient<BrandsAndManagersType>({
    endpoint: "brands",
    clientId: String(clientId),
    search: searchTerm,
  });

  const options: Option[] = useMemo(
    () =>
      (data?.data ?? [])
        .filter((brand) => Number(brand.id) !== Number(excludeBrandId))
        .map((brand) => ({ value: Number(brand.id), label: brand.brand_name })),
    [data, excludeBrandId]
  );

  const selected: Option[] = value.map((brand) => ({ value: brand.id, label: brand.name }));

  return (
    <Select<Option, true>
      inputId={inputId}
      isMulti
      isLoading={isLoading}
      isDisabled={disabled}
      options={options}
      value={selected}
      placeholder="Agregar marcas asociadas..."
      onChange={(next) => onChange((next ?? []).map((o) => ({ id: o.value, name: o.label })))}
      onInputChange={handleInputChange}
      onBlur={resetSearch}
      filterOption={() => true}
      classNamePrefix="react-select"
      loadingMessage={() => "Cargando marcas..."}
      noOptionsMessage={() =>
        isError ? "Error al cargar las marcas" : "No hay más marcas de este cliente"
      }
    />
  );
}

export default AdditionalBrandsSelect;
