import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { URL_BACKEND_API } from "@/config/constants";


const fetchItems = async (resource: string) => {
  const response = await axios.get(`${URL_BACKEND_API}${resource}`);
  const data = response.data;
  return data;
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