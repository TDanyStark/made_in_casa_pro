import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useItemMutations from '@/hooks/useItemsMutation';

// Mock apiService
jest.mock('@/lib/services/apiService', () => ({
  post: jest.fn(),
  put: jest.fn(),
  del: jest.fn(),
}));

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { post, put, del } from '@/lib/services/apiService';
import { toast } from 'sonner';

const mockPost = post as jest.MockedFunction<typeof post>;
const mockPut = put as jest.MockedFunction<typeof put>;
const mockDel = del as jest.MockedFunction<typeof del>;

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useItemMutations() — createItem', () => {
  it('calls post() with the resource and item data', async () => {
    mockPost.mockResolvedValueOnce({ ok: true, status: 201, data: { id: 1 } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useItemMutations('clients'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.createItem.mutateAsync({ name: 'New Client' } as never);
    });

    expect(mockPost).toHaveBeenCalledWith('clients', expect.objectContaining({ name: 'New Client' }));
  });

  it('calls toast.success with "{resource} creado exitosamente" on success', async () => {
    mockPost.mockResolvedValueOnce({ ok: true, status: 201, data: {} });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useItemMutations('managers'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.createItem.mutateAsync({ name: 'M' } as never);
    });

    expect(toast.success).toHaveBeenCalledWith('managers creado exitosamente');
  });

  it('calls setIsOpen(false) when provided and creation succeeds', async () => {
    mockPost.mockResolvedValueOnce({ ok: true, status: 201, data: {} });
    const setIsOpen = jest.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useItemMutations('clients', setIsOpen), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.createItem.mutateAsync({ name: 'C' } as never);
    });

    expect(setIsOpen).toHaveBeenCalledWith(false);
  });

  it('does NOT call setIsOpen when it was not provided', async () => {
    mockPost.mockResolvedValueOnce({ ok: true, status: 201, data: {} });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useItemMutations('clients'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.createItem.mutateAsync({ name: 'C' } as never);
    });

    // No error should occur from calling a non-existent setIsOpen
    expect(toast.success).toHaveBeenCalled();
  });

  it('calls toast.error when response.ok is false', async () => {
    mockPost.mockResolvedValueOnce({ ok: false, status: 400, error: 'Bad data' });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useItemMutations('clients'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      try {
        await result.current.createItem.mutateAsync({ name: 'Bad' } as never);
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('invalidates the query cache for [resource] on success', async () => {
    mockPost.mockResolvedValueOnce({ ok: true, status: 201, data: {} });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useItemMutations('brands'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.createItem.mutateAsync({ name: 'Brand' } as never);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['brands'] });
  });
});

describe('useItemMutations() — updateItem', () => {
  it('calls put() with "{resource}/{id}" and item data', async () => {
    mockPut.mockResolvedValueOnce({ ok: true, status: 200, data: {} });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useItemMutations('clients'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.updateItem.mutateAsync({ id: 5, name: 'Updated' } as never);
    });

    expect(mockPut).toHaveBeenCalledWith('clients/5', expect.objectContaining({ id: 5, name: 'Updated' }));
  });

  it('calls toast.success with "{resource} actualizado exitosamente" on success', async () => {
    mockPut.mockResolvedValueOnce({ ok: true, status: 200, data: {} });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useItemMutations('users'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.updateItem.mutateAsync({ id: 1, name: 'U' } as never);
    });

    expect(toast.success).toHaveBeenCalledWith('users actualizado exitosamente');
  });

  it('calls toast.error when put() response.ok is false', async () => {
    mockPut.mockResolvedValueOnce({ ok: false, status: 500, error: 'Server error' });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useItemMutations('clients'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      try {
        await result.current.updateItem.mutateAsync({ id: 1, name: 'Bad' } as never);
      } catch {
        // Expected
      }
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});

describe('useItemMutations() — deleteItem', () => {
  it('calls del() with "{resource}/{id}" using the provided id', async () => {
    mockDel.mockResolvedValueOnce({ ok: true, status: 200, data: {} });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useItemMutations('clients'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.deleteItem.mutateAsync(7);
    });

    expect(mockDel).toHaveBeenCalledWith('clients/7');
  });

  it('calls toast.success with "{resource} eliminado exitosamente" on success', async () => {
    mockDel.mockResolvedValueOnce({ ok: true, status: 200, data: {} });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useItemMutations('brands'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.deleteItem.mutateAsync(3);
    });

    expect(toast.success).toHaveBeenCalledWith('brands eliminado exitosamente');
  });

  it('invalidates the query cache for [resource] on delete success', async () => {
    mockDel.mockResolvedValueOnce({ ok: true, status: 200, data: {} });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useItemMutations('users'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.deleteItem.mutateAsync(2);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users'] });
  });

  it('calls toast.error on failure', async () => {
    mockDel.mockResolvedValueOnce({ ok: false, status: 500, error: 'Failed' });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useItemMutations('clients'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      try {
        await result.current.deleteItem.mutateAsync(1);
      } catch {
        // Expected
      }
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
