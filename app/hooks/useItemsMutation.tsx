import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner"
import { post, put, del } from "@/lib/services/apiService";

// Modificamos la definición para hacer el id opcional en las operaciones de creación
const useItemMutations = <T extends { id?: number }>(
  resource: string,
  setIsOpen?: (state: boolean) => void
) => {
  const queryClient = useQueryClient();

  // Create Mutation - ahora puede aceptar datos sin id
  const createItem = useMutation<unknown, Error, T>(
    {
      mutationFn: async (newItem: T) => {
        const response = await post<T>(resource, newItem as Record<string, unknown>);
        if (!response.ok) {
          throw new Error(response.error || "Error en la petición");
        }
        return response.data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [resource] });
        toast.success(`${resource} creado exitosamente`);
        if (setIsOpen) {
          setIsOpen(false);
        }
      },
      onError: (error) => {
        toast.error(`Error creando el ${resource}: ${error.message}`);
      },
    },
  );

  // Update Mutation - requiere un id válido
  const updateItem = useMutation<unknown, Error, T & { id: number }>(
    {
      mutationFn: async (updatedItem: T & { id: number }) => {
        const response = await put<T>(`${resource}/${updatedItem.id}`, updatedItem as Record<string, unknown>);
        if (!response.ok) {
          throw new Error(response.error || "Error en la petición");
        }
        return response.data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [resource] });
        toast.success(`${resource} actualizado exitosamente`);
        if (setIsOpen) {
          setIsOpen(false);
        }
      },
      onError: (error) => {
        toast.error(`Error actualizando el ${resource}: ${error.message}`);
      },
    },
  );

  // Delete Mutation
  const deleteItem = useMutation<unknown, Error, number>(
    {
      mutationFn: async (id: number) => {
        const response = await del<T>(`${resource}/${id}`);
        if (!response.ok) {
          throw new Error(response.error || "Error en la petición");
        }
        return response.data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [resource] });
        toast.success(`${resource} eliminado exitosamente`);
      },
      onError: (error) => {
        toast.error(`Error eliminando el ${resource}: ${error.message}`);
      },
    },
  );


  // Retornar el estado de carga junto con las mutaciones
  return {
    createItem,
    updateItem,
    deleteItem,
  };
};

export default useItemMutations;
