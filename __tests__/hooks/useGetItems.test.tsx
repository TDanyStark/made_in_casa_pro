import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useGetItems from '@/hooks/useGetItems';

// Mock apiService
jest.mock('@/lib/services/apiService', () => ({
  get: jest.fn(),
}));

import { get } from '@/lib/services/apiService';
const mockGet = get as jest.MockedFunction<typeof get>;

// Factory: creates a fresh QueryClient wrapper per test to prevent cache bleed
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useGetItems()', () => {
  it('calls apiService.get() with the provided resource string', async () => {
    mockGet.mockResolvedValueOnce({ ok: true, status: 200, data: [] });
    const { result } = renderHook(() => useGetItems('clients'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith('clients');
  });

  it('returns response.data on a successful response', async () => {
    const mockData = [{ id: 1, name: 'Test' }];
    mockGet.mockResolvedValueOnce({ ok: true, status: 200, data: mockData });
    const { result } = renderHook(() => useGetItems('clients'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it('is in loading state initially', () => {
    mockGet.mockImplementation(() => new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useGetItems('clients'), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('throws an Error with response.error when response.ok is false', async () => {
    mockGet.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'Forbidden',
    });
    const { result } = renderHook(() => useGetItems('clients'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('Forbidden');
  });

  it('uses the fallback error message when response.error is undefined', async () => {
    mockGet.mockResolvedValueOnce({ ok: false, status: 500 });
    const { result } = renderHook(() => useGetItems('clients'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('Error al obtener datos');
  });

  it('uses the resource string as the queryKey', async () => {
    mockGet.mockResolvedValueOnce({ ok: true, status: 200, data: [] });
    // Test indirectly: calling with different resources makes separate requests
    const client1Wrapper = createWrapper();
    const client2Wrapper = createWrapper();
    mockGet.mockResolvedValue({ ok: true, status: 200, data: [] });

    const { result: r1 } = renderHook(() => useGetItems('clients'), { wrapper: client1Wrapper });
    const { result: r2 } = renderHook(() => useGetItems('managers'), { wrapper: client2Wrapper });
    await waitFor(() => expect(r1.current.isSuccess).toBe(true));
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith('clients');
    expect(mockGet).toHaveBeenCalledWith('managers');
  });
});
