'use client';

import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/services/apiService';

interface FetchWithParameterProps {
  endpoint: string;
  paramName: string;
  paramValue: string | number | null | undefined;
  queryKey: string;
  staleTime?: number;
}

/**
 * Hook para realizar consultas a una API con un solo parámetro en la URL
 * y que se ejecuta solo cuando el parámetro existe.
 * 
 * @param endpoint - Ruta de la API a consultar
 * @param paramName - Nombre del parámetro en la URL
 * @param paramValue - Valor del parámetro
 * @param queryKey - Clave para React Query
 * @param staleTime - Tiempo en milisegundos antes de que la consulta se considere obsoleta (default: 5 minutos)
 * @returns Un objeto de consulta de React Query
 */
export const useFetchWithParameter = <T>({
  endpoint,
  paramName,
  paramValue,
  queryKey,
  staleTime = 1000 * 60 * 5, // 5 minutos por defecto
}: FetchWithParameterProps) => {
  
  const fetchData = async (): Promise<T> => {
    if (!paramValue) {
      throw new Error(`Parameter ${paramName} is required`);
    }
    
    const url = `${endpoint}?${paramName}=${encodeURIComponent(String(paramValue))}`;
    const res = await get<T>(url);

    if (!res.ok) {
      throw new Error(res.error || `Failed to fetch from ${endpoint}`);
    }

    return res.data as T;
  };

  return useQuery({
    queryKey: [queryKey, paramValue],
    queryFn: fetchData,
    enabled: !!paramValue,
    staleTime,
  });
};