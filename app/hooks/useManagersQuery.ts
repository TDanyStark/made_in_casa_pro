'use client';

import { useQuery } from '@tanstack/react-query';
import { URL_BACKEND_API } from '@/config/constants';
import axios from 'axios';
import { ManagerType } from '@/lib/definitions';

interface ManagersParams {
  clientId?: string;
  page?: string;
  search?: string;
}

interface ManagersResponse {
  managers: ManagerType[];
  pageCount: number;
  currentPage: number;
  total: number;
}

const fetchManagers = async ({ clientId, page = "1", search }: ManagersParams): Promise<ManagersResponse> => {
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

  const apiUrl = `${URL_BACKEND_API || process.env.NEXT_PUBLIC_API_URL || ''}/managers?${searchParams.toString()}`;
  
  try {
    const response = await axios.get(apiUrl);
    return response.data;
  } catch (error) {
    console.error("Error fetching managers:", error);
    throw error;
  }
};

export const useManagersQuery = (params: ManagersParams) => {
  return useQuery({
    queryKey: ['managers', params],
    queryFn: () => fetchManagers(params),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
};