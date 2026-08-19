"use client";

import { useCallback, useMemo, useState } from "react";

interface SelectOptionLike {
  value: string | number;
}

/**
 * Combina las opciones recién obtenidas del backend con las opciones
 * "fijadas" (seleccionadas o recién creadas), garantizando que nunca
 * desaparezcan del listado aunque una refetch/invalidación de React Query
 * traiga una página de resultados que no las incluya.
 *
 * Problema que resuelve: ClientSelect, ManagerSelect, ChangeManager y
 * BrandSelect guardaban las opciones en un estado local que un `useEffect`
 * REEMPLAZABA por completo cada vez que cambiaban los datos de la query
 * (`setOptions(fetched)`). Si el cliente/gerente/marca recién creado o
 * seleccionado no venía en esa nueva página (por búsqueda, orden o
 * paginación), `options.find(o => o.value === field.value)` devolvía
 * `undefined` y el select se veía "vacío" aunque el formulario sí tuviera
 * el valor.
 *
 * Uso: llama a `pinOption(option)` en el `onChange` del select (cuando el
 * usuario elige una opción) y en el callback de creación inline (cuando se
 * crea una opción nueva desde el modal). El resto de las opciones sigue
 * reflejando exactamente lo que devuelve la búsqueda actual — no se
 * acumulan opciones irrelevantes de búsquedas anteriores.
 */
export function useStableSelectOptions<TOption extends SelectOptionLike>(
  fetchedOptions: TOption[]
) {
  const [pinned, setPinned] = useState<Map<TOption["value"], TOption>>(
    () => new Map()
  );

  const pinOption = useCallback((option: TOption | null | undefined) => {
    if (!option) return;
    setPinned((prev) => {
      const existing = prev.get(option.value);
      if (existing === option) return prev;
      const next = new Map(prev);
      next.set(option.value, option);
      return next;
    });
  }, []);

  const options = useMemo(() => {
    if (pinned.size === 0) return fetchedOptions;

    const fetchedIds = new Set(fetchedOptions.map((option) => option.value));
    const extras: TOption[] = [];
    pinned.forEach((option, id) => {
      if (!fetchedIds.has(id)) extras.push(option);
    });

    return extras.length > 0 ? [...extras, ...fetchedOptions] : fetchedOptions;
  }, [fetchedOptions, pinned]);

  return { options, pinOption } as const;
}

export default useStableSelectOptions;
