"use client";

import { useMemo, useState } from "react";
import CreatableSelect from "react-select/creatable";
import { debounce } from "lodash";
import { useGetEndpointQueryClient } from "@/hooks/useGetEndpointQueryClient";
import { useStableSelectOptions } from "@/hooks/useStableSelectOptions";
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  FormField,
} from "@/components/ui/form";
import {
  Control,
  FieldPath,
  FieldValues,
  PathValue,
  UseFormReturn,
} from "react-hook-form";
import CreateManagerModal from "./CreateManagerModal";
import { ManagerType } from "@/lib/definitions";
import {
  ManagerOption,
  createManagerOptionFormatter,
  toManagerOption,
} from "./managerOption";
import { useClientsDirectory } from "@/hooks/useClientsDirectory";

interface ManagerSelectProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Restringe la búsqueda a los gerentes de un cliente. */
  clientId?: number;
  /** Permite dejar el campo vacío (traslados: "sin sucesor"). */
  isClearable?: boolean;
  onChange?: (value: number | undefined) => void;
}

export function ManagerSelect<T extends FieldValues>({
  form,
  control,
  name,
  label = "Gerente",
  placeholder = "Selecciona o crea un gerente",
  required = false,
  disabled = false,
  clientId,
  isClearable = false,
  onChange,
}: ManagerSelectProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreatingManager, setIsCreatingManager] = useState(false);
  const [newManagerName, setNewManagerName] = useState("");

  // Sin filtro de cliente el select mezcla laboratorios: hace falta el nombre
  // del cliente para distinguir gerentes homónimos.
  const showClient = clientId === undefined;
  const { clientNames } = useClientsDirectory(showClient);

  const { data, isLoading: isLoadingManagers } = useGetEndpointQueryClient<ManagerType>({
    clientId: clientId?.toString(),
    search: searchTerm,
    endpoint: "managers",
  });

  const managers = useMemo(() => data?.data || [], [data]);

  const fetchedOptions: ManagerOption[] = useMemo(
    () => managers.map(toManagerOption),
    [managers]
  );

  const { options: managerOptions, pinOption } =
    useStableSelectOptions<ManagerOption>(fetchedOptions);

  const debouncedSearch = debounce((value: string) => {
    setSearchTerm(value);
  }, 500);

  const handleInputChange = (inputValue: string) => {
    if (inputValue.trim()) {
      debouncedSearch(inputValue);
    }
  };

  const formatOptionLabel = useMemo(
    () => createManagerOptionFormatter({ clientNames, showClient }),
    [clientNames, showClient]
  );

  const handleCreateManager = (inputValue: string) => {
    setIsCreatingManager(true);
    setNewManagerName(inputValue);
  };

  const handleResetSearch = () => {
    setSearchTerm("");
  };

  const handleManagerCreated = (newManager: ManagerType) => {
    pinOption(toManagerOption(newManager));

    // Select the newly created manager and notify parent
    if (onChange) {
      onChange(newManager.id as number);
    }

    // Actualizar el valor en el formulario usando la API pública de React Hook Form
    form.setValue(name, newManager.id as PathValue<T, FieldPath<T>>);

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
                isClearable={isClearable}
                value={
                  managerOptions.find(
                    (option) => option.value === field.value
                  ) ?? null
                }
                onChange={(selectedOption) => {
                  pinOption(selectedOption ?? undefined);
                  field.onChange(selectedOption?.value);
                  if (onChange) onChange(selectedOption?.value);
                }}
                onInputChange={handleInputChange}
                onCreateOption={handleCreateManager}
                onBlur={handleResetSearch}
                formatCreateLabel={(inputValue) =>
                  `Crear gerente "${inputValue}"`
                }
                formatOptionLabel={formatOptionLabel}
                isDisabled={disabled}
                classNamePrefix="react-select"
                // Sin menuPortalTarget/menuPosition="fixed" a propósito: el
                // menú se renderiza en flujo normal (position:absolute
                // relativo al propio control), lo que lo mantiene dentro del
                // DOM del Dialog (Radix) que lo contiene. Portalar a
                // document.body con posición "fixed" rompía dos cosas dentro
                // de un Dialog modal: (1) Radix envuelve el Overlay en
                // react-remove-scroll con `shards: [DialogContent]`, así que
                // cualquier wheel/touchmove fuera de ese shard se bloqueaba
                // — el menú no hacía scroll aunque pointer-events estuviera
                // arreglado; y (2) `DialogContent` usa `translate-x/y` para
                // centrarse, lo que lo convierte en containing block de sus
                // descendientes `position:fixed`, rompiendo el cálculo de
                // posición (viewport-relative) que hace react-select.
                menuPlacement="bottom"
                maxMenuHeight={240}
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
