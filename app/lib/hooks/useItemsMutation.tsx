import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner"
import { URL_BACKEND_API } from "@/variables";

const useItemMutations = <T extends { id: number }>(
  resource: string,
  setIsOpen?: (state: boolean) => void
) => {
  const queryClient = useQueryClient();

  // Create Mutation
  const createItem = useMutation<unknown, Error, T>(
    {
      mutationFn: (newItem: T) =>
        axios.post(`${URL_BACKEND_API}${resource}`, newItem).then(response => response.data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [resource] });
        toast.success(`${resource} creado exitosamente`);
        if (setIsOpen) {
          setIsOpen(false);
        }
      },
      onError: (error) => {
        if (axios.isAxiosError(error) && error.response) {
          const errorMessage = error.response.data?.data?.error || "Error desconocido";
          toast.error(`Error creando el ${resource}: ${errorMessage}`);
        } else {
          toast.error(`Error creando el ${resource}`);
        }
      },
    },
  );

  const updateItem = useMutation<unknown, Error, T>(
    {
      mutationFn: (newItem: T) =>
        axios.put(`${URL_BACKEND_API}${resource}/${newItem.id}`, newItem).then(response => response.data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [resource] });
        toast.success(`${resource} actualizado exitosamente`);
        if (setIsOpen) {
          setIsOpen(false);
        }
      },
      onError: (error) => {
        if (axios.isAxiosError(error) && error.response) {
          const errorMessage = error.response.data?.data?.error || "Error desconocido";
          toast.error(`Error actualizando el ${resource}: ${errorMessage}`);
        } else {
          toast.error(`Error actualizando el ${resource}`);
        }
      },
    },
  );

  const deleteItem = useMutation<unknown, Error, number>(
    {
      mutationFn: (id: number) =>
        axios.delete(`${URL_BACKEND_API}${resource}/${id}`).then(response => response.data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [resource] });
        toast.success(`${resource} eliminado exitosamente`);
      },
      onError: (error) => {
        if (axios.isAxiosError(error) && error.response) {
          const errorMessage = error.response.data?.data?.error || "Error desconocido";
          toast.error(`Error eliminando el ${resource}: ${errorMessage}`);
        } else {
          toast.error(`Error eliminando el ${resource}`);
        }
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
