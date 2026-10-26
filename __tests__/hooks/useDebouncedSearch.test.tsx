import { act, renderHook } from '@testing-library/react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';

describe('useDebouncedSearch', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('applies the typed term after the delay, coalescing keystrokes across re-renders', () => {
    const { result, rerender } = renderHook(() => useDebouncedSearch(500));
    act(() => result.current.handleInputChange('a'));
    rerender();
    act(() => result.current.handleInputChange('ab'));
    rerender();
    act(() => { jest.advanceTimersByTime(499); });
    expect(result.current.searchTerm).toBe('');
    act(() => { jest.advanceTimersByTime(1); });
    expect(result.current.searchTerm).toBe('ab');
  });

  it('keeps handleInputChange stable across renders', () => {
    const { result, rerender } = renderHook(() => useDebouncedSearch(500));
    const first = result.current.handleInputChange;
    rerender();
    expect(result.current.handleInputChange).toBe(first);
  });

  it('clearing the input resets the term immediately and drops a pending search', () => {
    const { result } = renderHook(() => useDebouncedSearch(500));
    act(() => result.current.handleInputChange('acme'));
    act(() => { jest.advanceTimersByTime(500); });
    expect(result.current.searchTerm).toBe('acme');

    act(() => result.current.handleInputChange('zz'));
    act(() => result.current.handleInputChange(''));
    expect(result.current.searchTerm).toBe('');
    act(() => { jest.advanceTimersByTime(1000); });
    expect(result.current.searchTerm).toBe('');
  });

  it('resetSearch clears the term and drops a pending search', () => {
    const { result } = renderHook(() => useDebouncedSearch(500));
    act(() => result.current.handleInputChange('acme'));
    act(() => result.current.resetSearch());
    act(() => { jest.advanceTimersByTime(1000); });
    expect(result.current.searchTerm).toBe('');
  });

  it('cancels a pending search on unmount', () => {
    const { result, unmount } = renderHook(() => useDebouncedSearch(500));
    act(() => result.current.handleInputChange('acme'));
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
