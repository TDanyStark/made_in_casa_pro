"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { debounce } from "lodash";
import { toast } from "sonner";

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
import { ManagerType } from "@/lib/definitions";
import { useGetEndpointQueryClient } from "@/hooks/useGetEndpointQueryClient";
import { patch } from "@/lib/services/apiService";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  manager_id: z.coerce.number().int().positive("Se requiere un gerente válido"),
});

type ChangeManagerFormData = z.infer<typeof formSchema>;

interface Props {
  brandId: number;
  managerId: number;
  clientId: number;
  onSuccess?: () => void;
}

export function ChangeManager({ brandId, managerId, clientId, onSuccess }: Props) {
  const form = useForm<ChangeManagerFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      manager_id: managerId,
    },
  });

  const [managerOptions, setManagerOptions] = useState<
    { value: number; label: string }[]
  >([]);
  const [isCreatingManager, setIsCreatingManager] = useState(false);
  const [newManagerName, setNewManagerName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { refresh } = useRouter();
  const queryClient = useQueryClient()



  // Query para gerentes usando React Query
  const { data, isLoading: isLoadingManagers } = useGetEndpointQueryClient<ManagerType>({
    clientId: String(clientId),
    search: searchTerm,
    endpoint: "managers",
  });

  const managers = useMemo(() => data?.data || [], [data]);

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
    // si el manager_id es el mismo al actual no hacer la peticion
    if (data.manager_id === managerId) {
      toast.error("El gerente ya está asignado a esta marca");
      return;
    }
    setIsSubmitting(true);
    
    try {
      // Usar el servicio de API centralizado para actualizar el gerente de la marca
      const response = await patch(`brands/${brandId}`, {
        manager_id: data.manager_id
      });

      if (!response.ok) {
        throw new Error(response.error || "Error al actualizar el gerente");
      }

      // Mostrar notificación de éxito
      toast.success("Gerente asignado correctamente");
      
      // Invalidar la consulta de historial correctamente usando el mismo formato de clave
      // que se usa en useFetchWithParameter
      queryClient.invalidateQueries({ 
        queryKey: ["brandHistory", String(brandId)],
      });
      
      // Llamar al callback onSuccess si existe
      if (onSuccess) {
        onSuccess();
      }else {
        // Si no hay callback, recargar la página
        refresh();
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

  if (!brandId) {
    return null;
  }

  return (
    <>
      <div className="mt-2">
        <h3 className="text-sm font-medium mb-2">Cambiar Gerente</h3>
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
                      className="react-select-container min-w-72"
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
              disabled={isSubmitting || isLoadingManagers || form.watch("manager_id") === managerId} 
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
        clientId={clientId || 0}
        openModal={isCreatingManager}
        handleModal={(state) => setIsCreatingManager(state)}
        onSuccess={handleManagerCreated}
        initialName={newManagerName}
      />
    </>
  );
}

export default ChangeManager;