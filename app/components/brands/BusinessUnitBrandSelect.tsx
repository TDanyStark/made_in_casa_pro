"use client";

import { useEffect, useMemo, useState } from "react";
import CreatableSelect from "react-select/creatable";
import { debounce } from "lodash";
import { useGetEndpointQuery } from "@/hooks/useGetEndpointQuery";
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Control, UseFormReturn } from "react-hook-form";
import { FormField } from "@/components/ui/form";
import { BusinessUnitType } from "@/lib/definitions";
import { post, patch } from "@/lib/services/apiService";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { BrandFormData } from "../clients/CreateBrandModal";

interface BusinessUnitOption {
  value: number;
  label: string;
}

interface BusinessUnitBrandSelectProps {
  form: UseFormReturn<BrandFormData>; 
  control: Control<BrandFormData>;
  name: "business_unit_id" | "name" | "id";
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  brandId?: string | number;
  onChange?: (value: number | undefined) => void;
}

export function BusinessUnitBrandSelect({
  form,
  control,
  name,
  label = "Unidad de Negocio",
  placeholder = "Selecciona o crea una unidad de negocio",
  required = false,
  disabled = false,
  brandId,
  onChange,
}: BusinessUnitBrandSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [businessUnitOptions, setBusinessUnitOptions] = useState<
    BusinessUnitOption[]
  >([]);
  const [isCreatingBusinessUnit, setIsCreatingBusinessUnit] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useGetEndpointQuery<BusinessUnitType>({
    search: searchTerm,
    endpoint: "business_units",
  });

  const businessUnits = useMemo(() => data?.data || [], [data]);

  const debouncedSearch = debounce((value: string) => {
    setSearchTerm(value);
  }, 500);

  const handleInputChange = (inputValue: string) => {
    if (inputValue.trim()) {
      debouncedSearch(inputValue);
    }
  };

  useEffect(() => {
    if (businessUnits) {
      const options = businessUnits.map((businessUnit: BusinessUnitType) => ({
        value: businessUnit.id,
        label: businessUnit.name,
      }));
      setBusinessUnitOptions(options);
    }
  }, [businessUnits]);

  // Handle selecting an existing business unit for a brand
  const handleSelectBusinessUnit = async (businessUnitId: number) => {
    if (!brandId) return;

    try {
      const response = await patch<BusinessUnitType>(`brands/${brandId}`, {
        business_unit_id: businessUnitId,
      });

      if (!response.ok) {
        throw new Error(
          response.error || "Error al actualizar la unidad de negocio"
        );
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      queryClient.invalidateQueries({ queryKey: ["brands", String(brandId)] });

      const businessUnit = businessUnitOptions.find(
        (option) => option.value === businessUnitId
      );
      toast.success(
        `Unidad de negocio "${businessUnit?.label}" asignada a esta marca`
      );
    } catch (error) {
      toast.error("Error al asignar la unidad de negocio");
      console.error(error);
    }
  };

  // Mover la función handleCreateBusinessUnit aquí para tener acceso a field
  const handleCreateBusinessUnit = async (inputValue: string) => {
    setIsCreatingBusinessUnit(true);

    try {
      // Create new business unit using apiService
      const response = await post<BusinessUnitType>("business_units", {
        name: inputValue,
      });

      if (!response.ok) {
        throw new Error(
          response.error || "Error al crear la unidad de negocio"
        );
      }

      const newBusinessUnit = response.data as BusinessUnitType;

      // Update the options
      setBusinessUnitOptions((prev) => [
        ...prev,
        { value: newBusinessUnit.id, label: newBusinessUnit.name },
      ]);

      // Actualizar el valor del campo del formulario con el nuevo business unit
      // Usar formContext para actualizar el valor si está disponible
        form.setValue(name, newBusinessUnit.id as number);

      if (brandId) {
        try {
          const updateResponse = await patch<BusinessUnitType>(
            `brands/${brandId}`,
            {
              business_unit_id: newBusinessUnit.id,
            }
          );

          if (!updateResponse.ok) {
            throw new Error(
              updateResponse.error || "Error al actualizar la marca"
            );
          }

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ["brands"] });
          queryClient.invalidateQueries({
            queryKey: ["brands", String(brandId)],
          });

          toast.success(
            `Unidad de negocio "${inputValue}" asignada a esta marca`
          );
        } catch (error) {
          toast.error("Error al asignar la unidad de negocio a la marca");
          console.error(error);
        }
      } else {
        // Just notify the creation
        toast.success(`Unidad de negocio "${inputValue}" creada con éxito`);

        // Call onChange if provided
        if (onChange) onChange(newBusinessUnit.id);
      }

      // Invalidate business units query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["business_units"] });

      return newBusinessUnit.id;
    } catch (error) {
      toast.error(
        `Error al crear la unidad de negocio: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
      console.error(error);
    } finally {
      setIsCreatingBusinessUnit(false);
    }
  };

  const filterOption = () => true;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <CreatableSelect
              isLoading={isLoading || isCreatingBusinessUnit}
              options={businessUnitOptions}
              placeholder={placeholder}
              required={required}
              value={businessUnitOptions.find(
                (option) => option.value === field.value
              )}
              onChange={(selectedOption) => {
                field.onChange(selectedOption?.value);
                if (onChange) onChange(selectedOption?.value);
                if (brandId && selectedOption?.value) {
                  handleSelectBusinessUnit(selectedOption.value);
                }
              }}
              onInputChange={handleInputChange}
              onCreateOption={handleCreateBusinessUnit}
              formatCreateLabel={(inputValue) =>
                `Crear unidad de negocio "${inputValue}"`
              }
              filterOption={filterOption}
              isDisabled={disabled}
              classNamePrefix="react-select"
              loadingMessage={() => "Cargando unidades de negocio..."}
              noOptionsMessage={({ inputValue }) =>
                inputValue
                  ? "No se encontraron unidades de negocio"
                  : "Escribe para buscar unidades de negocio"
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export default BusinessUnitBrandSelect;
