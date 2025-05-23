"use client";

import { useEffect, useMemo, useState } from "react";
import CreatableSelect from "react-select/creatable";
import { debounce } from "lodash";
import { useGetEndpointQueryClient } from "@/hooks/useGetEndpointQueryClient";
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

// Props para cuando se usa en un formulario
interface FormBusinessUnitBrandSelectProps {
  form: UseFormReturn<BrandFormData>; 
  control: Control<BrandFormData>;
  name: "business_unit_id" | "name" | "manager_id";
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  brandId?: string | number;
  onChange?: (value: number | undefined) => void;
  standalone?: false;
}

// Props para cuando se usa de forma independiente
interface StandaloneBusinessUnitBrandSelectProps {
  form?: never;
  control?: never;
  name?: never;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  brandId: string | number;
  onChange?: (value: number | undefined) => void;
  standalone: true;
  value?: number;
}

// Unión de tipos para mayor flexibilidad
type BusinessUnitBrandSelectProps = FormBusinessUnitBrandSelectProps | StandaloneBusinessUnitBrandSelectProps;

export function BusinessUnitBrandSelect(props: BusinessUnitBrandSelectProps) {
  const {
    label = "Unidad de Negocio",
    placeholder = "Selecciona o crea una unidad de negocio",
    required = false,
    disabled = false,
    brandId,
    onChange,
    standalone = false
  } = props;

  const [searchTerm, setSearchTerm] = useState("");
  const [businessUnitOptions, setBusinessUnitOptions] = useState<
    BusinessUnitOption[]
  >([]);
  const [isCreatingBusinessUnit, setIsCreatingBusinessUnit] = useState(false);
  const [selectedValue, setSelectedValue] = useState<number | undefined>(props.standalone && props.value ? props.value : undefined);
  const queryClient = useQueryClient();

  const { data, isLoading } = useGetEndpointQueryClient<BusinessUnitType>({
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

  // Crear unidad de negocio
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

      // Actualizar el valor según el modo (formulario o independiente)
      if (!standalone && props.form) {
        props.form.setValue(props.name, newBusinessUnit.id as number);
      } else if (standalone) {
        setSelectedValue(newBusinessUnit.id);
      }

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
      }

      // Call onChange if provided
      if (onChange) onChange(newBusinessUnit.id);

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

  // Renderizado del select para uso independiente
  const renderStandaloneSelect = () => {
    return (
      <div>
        {label && <label className="text-sm font-medium mb-1 block">{label}</label>}
        <CreatableSelect
          isLoading={isLoading || isCreatingBusinessUnit}
          options={businessUnitOptions}
          placeholder={placeholder}
          required={required}
          value={businessUnitOptions.find(
            (option) => option.value === selectedValue
          )}
          onChange={(selectedOption) => {
            setSelectedValue(selectedOption?.value);
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
      </div>
    );
  };

  // Si es independiente, usamos el renderizado personalizado
  if (standalone) {
    return renderStandaloneSelect();
  }

  // Si es parte de un formulario, usamos FormField
  return (
    <FormField
      control={props.control}
      name={props.name as FormBusinessUnitBrandSelectProps["name"]}
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
              loadingMessage={() => "Cargando..."}
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
