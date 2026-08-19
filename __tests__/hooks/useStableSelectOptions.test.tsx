import { act, renderHook } from "@testing-library/react";
import { useStableSelectOptions } from "@/hooks/useStableSelectOptions";

interface Option {
  value: number;
  label: string;
}

describe("useStableSelectOptions()", () => {
  it("returns the fetched options as-is when nothing is pinned", () => {
    const fetched: Option[] = [{ value: 1, label: "Uno" }];
    const { result } = renderHook(({ options }) => useStableSelectOptions<Option>(options), {
      initialProps: { options: fetched },
    });

    expect(result.current.options).toEqual(fetched);
  });

  it("keeps a pinned option in the list even after a refetch replaces the fetched options", () => {
    const initial: Option[] = [{ value: 1, label: "Uno" }];
    const { result, rerender } = renderHook(
      ({ options }) => useStableSelectOptions<Option>(options),
      { initialProps: { options: initial } }
    );

    const created: Option = { value: 99, label: "Recién creado" };

    // Simulate selecting/creating an option (e.g. from an inline create modal).
    act(() => {
      result.current.pinOption(created);
    });

    expect(result.current.options).toEqual(
      expect.arrayContaining([created, ...initial])
    );

    // Simulate a React Query refetch that returns a page WITHOUT the pinned option
    // (e.g. because the search term reset, or pagination excludes it).
    const refetched: Option[] = [{ value: 2, label: "Dos" }];
    rerender({ options: refetched });

    // The previously pinned option must still be present and resolvable...
    expect(result.current.options).toEqual(
      expect.arrayContaining([created, ...refetched])
    );
    // ...and the fresh fetch results must be reflected too (no stale accumulation
    // of options beyond what's pinned).
    expect(result.current.options).toHaveLength(2);
  });

  it("does not duplicate an option that is both pinned and present in the fetched list", () => {
    const shared: Option = { value: 5, label: "Compartida" };
    const { result, rerender } = renderHook(
      ({ options }) => useStableSelectOptions<Option>(options),
      { initialProps: { options: [shared] } }
    );

    act(() => {
      result.current.pinOption(shared);
    });

    rerender({ options: [shared] });

    expect(result.current.options).toEqual([shared]);
  });

  it("ignores null/undefined pins without throwing", () => {
    const { result } = renderHook(() => useStableSelectOptions<Option>([]));

    act(() => {
      result.current.pinOption(undefined);
      result.current.pinOption(null);
    });

    expect(result.current.options).toEqual([]);
  });

  it("drops a pinned option once the fetch itself includes an updated copy (fresh data wins)", () => {
    const stale: Option = { value: 3, label: "Nombre viejo" };
    const { result, rerender } = renderHook(
      ({ options }) => useStableSelectOptions<Option>(options),
      { initialProps: { options: [] as Option[] } }
    );

    act(() => {
      result.current.pinOption(stale);
    });
    expect(result.current.options).toEqual([stale]);

    const fresh: Option = { value: 3, label: "Nombre actualizado" };
    rerender({ options: [fresh] });

    // The fetched (fresher) copy wins over the pinned stale one — no duplicate id.
    expect(result.current.options).toEqual([fresh]);
  });
});
