'use client';

import { useQuery } from '@tanstack/react-query';
import { URL_BACKEND_API } from '@/config/constants';
import axios from 'axios';

// Define the parameters interface
interface ParamsUrl {
  clientId?: string;
  page?: string;
  search?: string;
  endpoint: string;
}

// Generic response interface
interface EndpointResponse<T> {
  data: T[];
  pageCount: number;
  currentPage: number;
  total: number;
}

const getEndpoint = async <T>({ clientId, page = "1", search, endpoint }: ParamsUrl): Promise<EndpointResponse<T>> => {
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

export const useGetEndpointQuery = <T>(params: ParamsUrl) => {
  const { endpoint } = params;
  
  return useQuery({
    queryKey: [endpoint, params],
    queryFn: () => getEndpoint<T>(params),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
};