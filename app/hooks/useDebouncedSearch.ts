"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { debounce } from "lodash";

/**
 * Término de búsqueda con debounce para selects asíncronos (react-select).
 *
 * - El debounce se crea una sola vez (no en cada render) y se cancela al desmontar.
 * - Borrar el texto del input quita el filtro de inmediato y descarta la búsqueda pendiente.
 */
export function useDebouncedSearch(delay = 500) {
  const [searchTerm, setSearchTerm] = useState("");

  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => setSearchTerm(value), delay),
    [delay]
  );

  useEffect(() => () => debouncedSetSearch.cancel(), [debouncedSetSearch]);

  const resetSearch = useCallback(() => {
    debouncedSetSearch.cancel();
    setSearchTerm("");
  }, [debouncedSetSearch]);

  const handleInputChange = useCallback(
    (inputValue: string) => {
      if (inputValue.trim()) {
        debouncedSetSearch(inputValue);
      } else {
        resetSearch();
      }
    },
    [debouncedSetSearch, resetSearch]
  );

  return { searchTerm, handleInputChange, resetSearch };
}
