/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import CreatableSelect from "react-select/creatable";
import { debounce } from "lodash";
import { useGetEndpointQuery } from "@/hooks/useGetEndpointQuery";
import { API_FLAG_URL, IMG_FLAG_EXT } from "@/config/constants";
import CreateClientModal from "./CreateClientModal";
import { 
  FormControl, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Control } from "react-hook-form";
import { FormField } from "@/components/ui/form";
import { ManagerFormData } from "@/components/managers/CreateManagerModal";

// Este tipo debe coincidir con la definición en su proyecto
interface ClientType {
  id: number;
  name: string;
  country?: {
    flag: string;
    name: string;
  };
}

interface ClientOption {
  value: number;
  label: string;
  countryFlag?: string;
  countryName?: string;
}

interface ClientSelectProps {
  control: Control<ManagerFormData>;
  name: "client_id" | "name" | "email" | "phone" | "biography" | "id";
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onChange?: (value: number | undefined) => void;
}

export function ClientSelect({
  control,
  name,
  label = "Cliente",
  placeholder = "Selecciona o crea un cliente",
  required = false,
  disabled = false,
  onChange,
}: ClientSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");

  const { data, isLoading: isLoadingClients } = useGetEndpointQuery<ClientType>({
    search: searchTerm,
    endpoint: "clients",
  });

  const clients: ClientType[] = useMemo(() => data?.data || [], [data]);

  const debouncedSearch = debounce((value: string) => {
    setSearchTerm(value);
  }, 500);

  const handleInputChange = (inputValue: string) => {
    if (inputValue.trim()) {
      debouncedSearch(inputValue);
    }
  };

  useEffect(() => {
    if (clients && clients.length > 0) {
      const options = clients.map((client: ClientType) => ({
        value: client.id,
        label: client.name,
        countryFlag: client.country
          ? `${API_FLAG_URL}${client.country.flag}${IMG_FLAG_EXT}`
          : undefined,
        countryName: client.country?.name,
      }));
      setClientOptions(options);
    }
  }, [clients]);

  const handleCreateClient = (inputValue: string) => {
    setIsCreatingClient(true);
    setNewClientName(inputValue);
  };

  const handleClientCreated = (newClient: ClientType) => {
    // Add the new client to the options
    const newOption = {
      value: newClient.id,
      label: newClient.name,
      countryFlag: newClient.country
        ? `${API_FLAG_URL}${newClient.country.flag}${IMG_FLAG_EXT}`
        : undefined,
      countryName: newClient.country?.name,
    };

    setClientOptions((prev) => [...prev, newOption]);

    // Select the newly created client and notify parent
    if (onChange) {
      onChange(newClient.id);
    }

    setIsCreatingClient(false);
  };

  // Custom format for option labels to display flags
  const formatOptionLabel = (option: ClientOption) => (
    <div className="flex items-center gap-2">
      <span>{option.label}</span>
      {option.countryFlag && (
        <img
          src={option.countryFlag}
          alt="Country flag"
          width={16}
          height={12}
          className="inline-block"
        />
      )}
    </div>
  );

  // Filter function - we'll let the backend handle the filtering now
  const filterOption = () => true;

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
                isLoading={isLoadingClients}
                options={clientOptions}
                placeholder={placeholder}
                required={required}
                value={clientOptions.find(
                  (option) => option.value === field.value
                )}
                onChange={(selectedOption) => {
                  field.onChange(selectedOption?.value);
                  if (onChange) onChange(selectedOption?.value);
                }}
                onInputChange={handleInputChange}
                onCreateOption={handleCreateClient}
                formatCreateLabel={(inputValue) =>
                  `Crear cliente "${inputValue}"`
                }
                formatOptionLabel={formatOptionLabel}
                filterOption={filterOption}
                isDisabled={disabled}
                classNamePrefix="react-select"
                loadingMessage={() => "Cargando clientes..."}
                noOptionsMessage={({ inputValue }) =>
                  inputValue
                    ? "No se encontraron clientes"
                    : "Escribe para buscar clientes por nombre o país"
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <CreateClientModal
        modalControl={{
          isOpen: isCreatingClient,
          setOpen: setIsCreatingClient,
        }}
        initialName={newClientName}
        onSuccess={handleClientCreated}
      />
    </>
  );
}

export default ClientSelect;