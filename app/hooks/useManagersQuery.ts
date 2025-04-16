'use client';

import { useQuery } from '@tanstack/react-query';
import { URL_BACKEND_API } from '@/config/constants';
import axios from 'axios';
import { ManagerType } from '@/lib/definitions';

interface ManagersParams {
  clientId?: string;
  page?: string;
  search?: string;
  endpoint: string; // Nuevo parámetro para el endpoint
}

interface ManagersResponse {
  managers: ManagerType[];
  pageCount: number;
  currentPage: number;
  total: number;
}

const fetchManagers = async ({ clientId, page = "1", search, endpoint }: ManagersParams): Promise<ManagersResponse> => {
  const searchParams = new URLSearchParams();

  if (clientId) {
    searchParams.append("client_id", clientId);
  }

  if (page) {
    searchParams.append("page", page);
  }

  if (search) {
    searchParams.append("search", search);
  }

  const apiUrl = `${URL_BACKEND_API || process.env.NEXT_PUBLIC_API_URL || ''}/${endpoint}?${searchParams.toString()}`;
  
  try {
    const response = await axios.get(apiUrl);
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    throw error;
  }
};

export const useManagersQuery = (params: ManagersParams) => {
  const { endpoint = "managers" } = params;
  
  return useQuery({
    queryKey: [endpoint, params],
    queryFn: () => fetchManagers(params),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
};