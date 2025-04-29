"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { debounce } from "lodash";
import { toast } from "sonner";

import "@/styles/selects.css";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import CreatableSelect from "react-select/creatable";
import CreateManagerModal from "@/components/managers/CreateManagerModal";
import { BrandType, ManagerType } from "@/lib/definitions";
import { useGetEndpointQuery } from "@/hooks/useGetEndpointQuery";
import { patch } from "@/lib/services/apiService";

const formSchema = z.object({
  id: z.coerce.number().int().positive("Se requiere un id válido"),
  name: z.string().min(1, "Se requiere un nombre"),
  manager_id: z.coerce.number().int().positive("Se requiere un gerente válido"),
});

type ChangeManagerFormData = z.infer<typeof formSchema>;

interface Props {
  brand: BrandType;
  onSuccess?: () => void;
}

export function ChangeManager({ brand, onSuccess }: Props) {
  const form = useForm<ChangeManagerFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: brand?.id,
      name: brand?.name,
      manager_id: brand?.manager_id,
    },
  });

  const [managerOptions, setManagerOptions] = useState<
    { value: number; label: string }[]
  >([]);
  const [isCreatingManager, setIsCreatingManager] = useState(false);
  const [newManagerName, setNewManagerName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recuperar client_id del manager actual
  const clientId = brand?.manager?.client_info?.id?.toString();

  // Query para gerentes usando React Query
  const { data, isLoading: isLoadingManagers } = useGetEndpointQuery<ManagerType>({
    clientId,
    search: searchTerm,
    endpoint: "managers",
  });

  const managers = useMemo(() => data?.data || [], [data]);
  console.log(managers)

  // Actualizar las opciones cuando cambian los datos de managers
  useEffect(() => {
    if (managers && managers.length > 0) {
      const options = managers.map((manager) => ({
        value: manager.id as number,
        label: manager.name,
      }));
      setManagerOptions(options);
    }
  }, [managers]);

  // Implementar debounce para la búsqueda
  const debouncedSearch = debounce((value: string) => {
    setSearchTerm(value);
  }, 500);

  // Actualizar la búsqueda cuando cambia el texto
  const handleInputChange = (inputValue: string) => {
    if (inputValue.trim()) {
      debouncedSearch(inputValue);
    }
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    console.log("Data to submit:", data);
    // si el manager_id es el mismo al actual no hacer la peticion
    if (data.manager_id === brand.manager_id) {
      toast.error("El gerente ya está asignado a esta marca");
      return;
    }
    setIsSubmitting(true);
    
    try {
      // Usar el servicio de API centralizado para actualizar el gerente de la marca
      const response = await patch(`brands/${data.id}`, {
        manager_id: data.manager_id
      });

      if (!response.ok) {
        throw new Error(response.error || "Error al actualizar el gerente");
      }

      // Mostrar notificación de éxito
      toast.success("Gerente asignado correctamente");
      
      // Llamar al callback onSuccess si existe
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al asignar el gerente");
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleCreateManager = (inputValue: string) => {
    setIsCreatingManager(true);
    setNewManagerName(inputValue);
  };

  const handleManagerCreated = (manager: ManagerType) => {
    // Agregar el nuevo gerente a las opciones
    const newOption = {
      value: manager.id as number,
      label: manager.name,
    };

    setManagerOptions((prev) => [...prev, newOption]);

    // Seleccionar el gerente recién creado
    form.setValue("manager_id", manager.id as number);

    setIsCreatingManager(false);
  };

  if (!brand) {
    return null;
  }

  return (
    <>
      <div className="mt-4">
        <h3 className="text-lg font-medium mb-2">Cambiar Gerente</h3>
        <Form {...form}>
          <form
            id="change-manager"
            onSubmit={handleSubmit}
            className="space-y-2"
          >
            <FormField
              control={form.control}
              name="manager_id"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <CreatableSelect
                      isLoading={isLoadingManagers}
                      options={managerOptions}
                      placeholder="Busca o crea un gerente"
                      value={managerOptions.find(
                        (option) => option.value === field.value
                      )}
                      onChange={(selectedOption) => {
                        field.onChange(selectedOption?.value);
                      }}
                      onInputChange={handleInputChange}
                      onCreateOption={handleCreateManager}
                      formatCreateLabel={(inputValue) =>
                        `Crear gerente "${inputValue}"`
                      }
                      className="react-select-container"
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

            <Button
              type="submit"
              disabled={isSubmitting || isLoadingManagers} 
              className="flex w-full gap-2"
            >
              {isSubmitting && (
                <Loader2 className="animate-spin mr-2" />
              )}
              Asignar Nuevo Gerente
            </Button>
          </form>
        </Form>
      </div>

      <CreateManagerModal
        clientId={parseInt(clientId || "0")}
        openModal={isCreatingManager}
        handleModal={(state) => setIsCreatingManager(state)}
        onSuccess={handleManagerCreated}
        initialName={newManagerName}
      />
    </>
  );
}

export default ChangeManager;