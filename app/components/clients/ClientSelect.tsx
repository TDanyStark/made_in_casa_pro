/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useRef, useState } from "react";
import CreatableSelect from "react-select/creatable";
import { debounce } from "lodash";
import { useGetEndpointQueryClient } from "@/hooks/useGetEndpointQueryClient";
import { useStableSelectOptions } from "@/hooks/useStableSelectOptions";
import { API_FLAG_URL, IMG_FLAG_EXT } from "@/config/constants";
import CreateClientModal from "./CreateClientModal";
import { 
  FormControl, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormField } from "@/components/ui/form";

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

interface ClientSelectProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Cliente que no debe ofrecerse (p. ej. el actual en un traslado). */
  excludeClientId?: number;
  onChange?: (value: number | undefined) => void;
}

export function ClientSelect<T extends FieldValues>({
  control,
  name,
  label = "Cliente",
  placeholder = "Selecciona o crea un cliente",
  required = false,
  disabled = false,
  excludeClientId,
  onChange,
}: ClientSelectProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  // Referencia al onChange del field del formulario para poder escribir el
  // cliente recién creado aunque el consumidor no pase un onChange propio.
  const fieldOnChangeRef = useRef<((value: number | undefined) => void) | null>(null);

  const { data, isLoading: isLoadingClients } = useGetEndpointQueryClient<ClientType>({
    search: searchTerm,
    endpoint: "clients",
  });

  const clients: ClientType[] = useMemo(() => data?.data || [], [data]);

  const fetchedOptions: ClientOption[] = useMemo(
    () =>
      clients
        .filter((client: ClientType) => client.id !== excludeClientId)
        .map((client: ClientType) => ({
          value: client.id,
          label: client.name,
          countryFlag: client.country
            ? `${API_FLAG_URL}${client.country.flag}${IMG_FLAG_EXT}`
            : undefined,
          countryName: client.country?.name,
        })),
    [clients, excludeClientId]
  );

  const { options: clientOptions, pinOption } =
    useStableSelectOptions<ClientOption>(fetchedOptions);

  const debouncedSearch = debounce((value: string) => {
    setSearchTerm(value);
  }, 500);

  const handleInputChange = (inputValue: string) => {
    if (inputValue.trim()) {
      debouncedSearch(inputValue);
    }
  };

  const handleCreateClient = (inputValue: string) => {
    setIsCreatingClient(true);
    setNewClientName(inputValue);
  };

  const handleResetSearch = () => {
    setSearchTerm("");
  };

  const handleClientCreated = (newClient: ClientType) => {
    // Fijamos la opción para que sobreviva a cualquier refetch posterior
    // que no la incluya en su página de resultados.
    const newOption = {
      value: newClient.id,
      label: newClient.name,
      countryFlag: newClient.country
        ? `${API_FLAG_URL}${newClient.country.flag}${IMG_FLAG_EXT}`
        : undefined,
      countryName: newClient.country?.name,
    };

    pinOption(newOption);

    // Seleccionar el cliente recién creado en el campo del formulario.
    // Antes solo se notificaba al padre (onChange) y, como CreateManagerModal
    // no lo pasaba, el cliente nuevo nunca quedaba seleccionado en el panel.
    if (fieldOnChangeRef.current) {
      fieldOnChangeRef.current(newClient.id);
    }

    // Notify parent if provided
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
        render={({ field }) => {
          // Guardamos la referencia al onChange del field para usarla al crear.
          fieldOnChangeRef.current = field.onChange;
          return (
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
                  pinOption(selectedOption ?? undefined);
                  field.onChange(selectedOption?.value);
                  if (onChange) onChange(selectedOption?.value);
                }}
                onInputChange={handleInputChange}
                onCreateOption={handleCreateClient}
                onBlur={handleResetSearch}
                formatCreateLabel={(inputValue) =>
                  `Crear cliente "${inputValue}"`
                }
                formatOptionLabel={formatOptionLabel}
                filterOption={filterOption}
                isDisabled={disabled}
                classNamePrefix="react-select"
                // Sin portal ni menuPosition="fixed": ver el comentario en
                // ManagerSelect.tsx — dentro de un Dialog (Radix), portalar
                // a document.body con posición fija rompe el scroll (queda
                // fuera del shard de react-remove-scroll) y el cálculo de
                // posición (DialogContent usa translate-x/y, que lo vuelve
                // containing block de sus descendientes fixed).
                menuPlacement="bottom"
                maxMenuHeight={240}
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
          );
        }}
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