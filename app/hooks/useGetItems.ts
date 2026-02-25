import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";


const fetchItems = async (resource: string) => {
  const response = await get(resource);
  if (!response.ok) {
    throw new Error(response.error || "Error al obtener datos");
  }
  return response.data;
};

const useGetItems = (resource: string) => {
  return useQuery({
    queryKey: [resource],
    queryFn: () => fetchItems(resource),
    staleTime: 1000 * 60 * 5, // 5 minutos
    // refetchOnWindowFocus: false, // Desactiva la refetch al reenfocar la ventana
  });
};

export default useGetItems;