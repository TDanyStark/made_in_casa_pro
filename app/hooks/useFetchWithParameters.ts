'use client';

import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/services/apiService';

// Define the parameters interface
interface ParamsObject {
  [key: string]: string | number | boolean | undefined;
}

// Generic response interface
interface EndpointResponse<T> {
  data: T[];
  pageCount?: number;
  currentPage?: number;
  total?: number;
}

/**
 * Fetches data from an endpoint with multiple parameters
 * @param endpoint API endpoint (relative to /api) to fetch data from
 * @param parameters Object with parameters to include in the URL
 * @returns Promise with the API response
 */
const fetchEndpoint = async <T>(endpoint: string, parameters: ParamsObject = {}): Promise<EndpointResponse<T>> => {
  const searchParams = new URLSearchParams();

  // Add all parameters that are defined to the search params
  Object.entries(parameters).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });

  const res = await get<EndpointResponse<T>>(`${endpoint}?${searchParams.toString()}`);
  if (!res.ok) {
    throw new Error(res.error || `Error fetching ${endpoint}`);
  }
  return res.data as EndpointResponse<T>;
};

/**
 * Custom hook to fetch data from an API with multiple parameters
 * @param endpoint The API endpoint to fetch data from
 * @param parameters An object with the parameters to include in the URL
 * @param options Additional options for the query
 * @returns The query result
 */
export const useFetchWithParameters = <T>(
  endpoint: string,
  parameters: ParamsObject = {},
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchOnWindowFocus?: boolean;
  }
) => {
  return useQuery({
    queryKey: [endpoint, parameters],
    queryFn: () => fetchEndpoint<T>(endpoint, parameters),
    staleTime: options?.staleTime || 1000 * 60 * 5, // Default: 5 minutes
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false, // Default: false
    enabled: options?.enabled ?? true, // Default: true
  });
};
