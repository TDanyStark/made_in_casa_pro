import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFetchWithParameters } from '@/hooks/useFetchWithParameters';
import { useFetchWithParameter } from '@/hooks/useFetchWithParameter';

jest.mock('@/lib/services/apiService', () => ({ get: jest.fn() }));
import { get } from '@/lib/services/apiService';
const mockGet = get as jest.MockedFunction<typeof get>;

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

describe('useFetchWithParameters', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls the relative /api endpoint through apiService without logging the URL', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockGet.mockResolvedValue({ ok: true, status: 200, data: { data: [{ id: 1 }] } });
    const { result } = renderHook(
      () => useFetchWithParameters('skills', { search: 'js', user_id: '3', skip: undefined }),
      { wrapper: wrapper() }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith('skills?search=js&user_id=3');
    expect(result.current.data).toEqual({ data: [{ id: 1 }] });
    expect(log).not.toHaveBeenCalled();
  });

  it('errors when the API responds !ok', async () => {
    mockGet.mockResolvedValue({ ok: false, status: 401, error: 'No autorizado' });
    const { result } = renderHook(() => useFetchWithParameters('skills', {}), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('No autorizado');
  });
});

describe('useFetchWithParameter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls apiService with the encoded parameter', async () => {
    mockGet.mockResolvedValue({ ok: true, status: 200, data: { history: [] } });
    const { result } = renderHook(
      () => useFetchWithParameter<{ history: unknown[] }>({
        endpoint: '/api/brands/history', paramName: 'brandId', paramValue: 'a b', queryKey: 'brandHistory',
      }),
      { wrapper: wrapper() }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith('/api/brands/history?brandId=a%20b');
    expect(result.current.data).toEqual({ history: [] });
  });

  it('errors when the API responds !ok and does not run without a parameter', async () => {
    mockGet.mockResolvedValue({ ok: false, status: 403, error: 'Sin permiso' });
    const { result } = renderHook(
      () => useFetchWithParameter({ endpoint: '/api/brands/history', paramName: 'brandId', paramValue: '5', queryKey: 'h' }),
      { wrapper: wrapper() }
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('Sin permiso');

    mockGet.mockClear();
    renderHook(
      () => useFetchWithParameter({ endpoint: '/api/brands/history', paramName: 'brandId', paramValue: null, queryKey: 'h2' }),
      { wrapper: wrapper() }
    );
    expect(mockGet).not.toHaveBeenCalled();
  });
});
