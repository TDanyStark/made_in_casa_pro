"use client";

import { useEffect, useMemo, useState } from "react";
import CreatableSelect from "react-select/creatable";
import { debounce } from "lodash";
import { useGetEndpointQueryClient } from "@/hooks/useGetEndpointQueryClient";
import { post, patch } from "@/lib/services/apiService";
import { AreaType } from "@/lib/definitions";
import { toast } from "sonner";

interface AreaOption {
  value: number;
  label: string;
}

interface AreaSelectProps {
  initial_value?: number;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onChange?: (value: number | undefined) => void;
  onBlur?: () => void;
  className?: string;
  label?: string;
  user_id: number;
}

const AreaSelect = ({
  initial_value,
  placeholder = "Selecciona o crea un área",
  required = false,
  disabled = false,
  onChange,
  onBlur,
  className,
  label,
  user_id,
}: AreaSelectProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [areaOptions, setAreaOptions] = useState<AreaOption[]>([]);
  const [isCreatingArea, setIsCreatingArea] = useState(false);
  const [value, setValue] = useState<number | undefined>(initial_value);

  const { data, isLoading: isLoadingAreas } =
    useGetEndpointQueryClient<AreaType>({
      search: searchTerm,
      endpoint: "areas",
    });

  const areas = useMemo(() => data?.data || [], [data]);

  const debouncedSearch = debounce((value: string) => {
    setSearchTerm(value);
  }, 500);

  const handleInputChange = (inputValue: string) => {
    if (inputValue.trim()) {
      debouncedSearch(inputValue);
    }
  };

  useEffect(() => {
    if (areas && areas.length > 0) {
      const options = areas.map((area: AreaType) => ({
        value: area.id as number,
        label: area.name,
      }));
      setAreaOptions(options);
    }
  }, [areas]);

  const handleCreateArea = async (inputValue: string) => {
    if (isCreatingArea || !inputValue.trim()) return;

    setIsCreatingArea(true);

    try {
      // Call the API endpoint to create a new area
      const response = await post<AreaType>("areas", {
        name: inputValue.trim(),
      });

      if (response.ok && response.data) {
        // Add the new area to the options
        const newOption = {
          value: response.data.id as number,
          label: response.data.name,
        };

        setAreaOptions((prev) => [...prev, newOption]);

        // Select the newly created area
        const areaId = response.data.id as number;

        // Update the internal state to select the new area
        setValue(areaId);

        if (onChange) {
          onChange(areaId);
        }

        // Update the user's area_id
        await updateUserArea(areaId);
      } else {
        console.error("Error creating area:", response.error);
        toast.error("Error al crear el área");
      }
    } catch (error) {
      console.error("Error creating area:", error);
      toast.error("Error al crear el área");
    } finally {
      setIsCreatingArea(false);
    }
  };
  const handleResetSearch = () => {
    setSearchTerm("");
    if (onBlur) onBlur();
  };

  // Function to update user's area_id in the database
  const updateUserArea = async (areaId: number) => {
    try {
      const response = await patch(`users/${user_id}`, {
        area_id: areaId,
      });

      if (response.ok) {
        toast.success("Área actualizada correctamente");
      } else {
        console.error("Error updating user area:", response.error);
        toast.error("Error al actualizar el área del usuario");
      }
    } catch (error) {
      console.error("Error updating user area:", error);
      toast.error("Error al actualizar el área del usuario");
    }
  };

  return (
    <div className={className}>
      {label && (
        <label className="text-sm font-medium mb-2 block">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <CreatableSelect
        isLoading={isLoadingAreas || isCreatingArea}
        options={areaOptions}
        placeholder={placeholder}
        required={required}
        value={areaOptions.find((option) => option.value === value)}
        onChange={(selectedOption) => {
          const areaId = selectedOption?.value;
          setValue(areaId);
          if (onChange) onChange(areaId);
          if (areaId !== undefined) {
            updateUserArea(areaId);
          }
        }}
        onInputChange={handleInputChange}
        onCreateOption={handleCreateArea}
        onBlur={handleResetSearch}
        formatCreateLabel={(inputValue) => `Crear área "${inputValue}"`}
        isDisabled={disabled}
        classNamePrefix="react-select"
        loadingMessage={() => "Cargando áreas..."}
        noOptionsMessage={({ inputValue }) =>
          inputValue ? "No se encontraron áreas" : "Escribe para buscar áreas"
        }
      />
    </div>
  );
};

export default AreaSelect;
