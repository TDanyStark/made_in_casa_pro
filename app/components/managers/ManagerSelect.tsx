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
  FormField
} from "@/components/ui/form";
import { Control } from "react-hook-form";
import CreateManagerModal from "./CreateManagerModal";
import { ManagerType } from "@/lib/definitions";
import { BrandFormData } from "../clients/CreateBrandModal";

interface ManagerOption {
  value: number;
  label: string;
}


interface ManagerSelectProps {
  control: Control<BrandFormData>;
  name: "manager_id" | "name";
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  clientId?: number;
  onChange?: (value: number | undefined) => void;
}

export function ManagerSelect({
  control,
  name,
  label = "Gerente",
  placeholder = "Selecciona o crea un gerente",
  required = false,
  disabled = false,
  clientId,
  onChange,
}: ManagerSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([]);
  const [isCreatingManager, setIsCreatingManager] = useState(false);
  const [newManagerName, setNewManagerName] = useState("");

  const { data, isLoading: isLoadingManagers } = useGetEndpointQuery<ManagerType>({
    clientId: clientId?.toString(),
    search: searchTerm,
    endpoint: "managers",
  });

  const managers = useMemo(() => data?.data || [], [data]);

  const debouncedSearch = debounce((value: string) => {
    setSearchTerm(value);
  }, 500);

  const handleInputChange = (inputValue: string) => {
    if (inputValue.trim()) {
      debouncedSearch(inputValue);
    }
  };

  useEffect(() => {
    if (managers && managers.length > 0) {
      const options = managers.map((manager: ManagerType) => ({
        value: manager.id as number,
        label: manager.name,
      }));
      setManagerOptions(options);
    }
  }, [managers]);

  const handleCreateManager = (inputValue: string) => {
    setIsCreatingManager(true);
    setNewManagerName(inputValue);
  };

  const handleManagerCreated = (newManager: ManagerType) => {
    // Add the new manager to the options
    const newOption = {
      value: newManager.id as number,
      label: newManager.name,
    };

    setManagerOptions((prev) => [...prev, newOption]);

    // Select the newly created manager and notify parent
    if (onChange) {
      onChange(newManager.id as number);
    }

    setIsCreatingManager(false);
  };

  return (
    <>
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <CreatableSelect
                isLoading={isLoadingManagers}
                options={managerOptions}
                placeholder={placeholder}
                required={required}
                value={managerOptions.find(
                  (option) => option.value === field.value
                )}
                onChange={(selectedOption) => {
                  field.onChange(selectedOption?.value);
                  if (onChange) onChange(selectedOption?.value);
                }}
                onInputChange={handleInputChange}
                onCreateOption={handleCreateManager}
                formatCreateLabel={(inputValue) =>
                  `Crear gerente "${inputValue}"`
                }
                isDisabled={disabled}
                classNamePrefix="react-select"
                loadingMessage={() => "Cargando gerentes..."}
                noOptionsMessage={({ inputValue }) =>
                  inputValue
                    ? "No se encontraron gerentes"
                    : "Escribe para buscar gerentes"
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <CreateManagerModal
        clientId={clientId}
        openModal={isCreatingManager}
        handleModal={(state) => setIsCreatingManager(state)}
        onSuccess={handleManagerCreated}
        initialName={newManagerName}
      />
    </>
  );
}

export default ManagerSelect;