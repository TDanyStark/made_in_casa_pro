'use client';

import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/services/apiService';

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

  const apiUrl = `${endpoint}?${searchParams.toString()}`;
  try {
    const response = await get<EndpointResponse<T>>(apiUrl);
    if (!response.ok) {
      throw new Error(response.error || `Error fetching ${endpoint}`);
    }
    return response.data as EndpointResponse<T>;
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    throw error;
  }
};

export const useGetEndpointQueryClient = <T>(params: ParamsUrl) => {
  const { endpoint } = params;
  
  return useQuery({
    queryKey: [endpoint, params],
    queryFn: () => getEndpoint<T>(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};