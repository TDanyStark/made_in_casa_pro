"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";

/**
 * Diccionario `client_id -> nombre` para desambiguar gerentes homónimos.
 *
 * El endpoint `GET /api/managers` devuelve `client_id` pero no el nombre del
 * cliente, y `GET /api/clients` está paginado (ITEMS_PER_PAGE). Este hook pagina
 * hasta agotar la lista y cachea el resultado con React Query, de modo que la
 * tabla de gerentes y los selects puedan mostrar el cliente sin tocar la capa de
 * queries ni los endpoints.
 */

type ClientRow = { id: number; name: string };

type ClientsPage = {
  data: ClientRow[];
  pageCount: number;
  currentPage: number;
  total: number;
};

/** Tope defensivo para no encadenar peticiones indefinidamente. */
const MAX_PAGES = 20;

async function fetchClientsPage(page: number): Promise<ClientsPage | null> {
  const res = await get<ClientsPage>(`clients?page=${page}`);
  if (!res.ok || !res.data) return null;
  return res.data as unknown as ClientsPage;
}

export async function fetchClientsDirectory(): Promise<Record<number, string>> {
  const names: Record<number, string> = {};

  const firstPage = await fetchClientsPage(1);
  if (!firstPage) return names;

  for (const client of firstPage.data ?? []) {
    names[client.id] = client.name;
  }

  const pageCount = Math.min(firstPage.pageCount ?? 1, MAX_PAGES);
  if (pageCount <= 1) return names;

  const remaining = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      fetchClientsPage(index + 2)
    )
  );

  for (const page of remaining) {
    for (const client of page?.data ?? []) {
      names[client.id] = client.name;
    }
  }

  return names;
}

export function useClientsDirectory(enabled = true) {
  const { data, isLoading } = useQuery({
    queryKey: ["clients-directory"],
    queryFn: fetchClientsDirectory,
    staleTime: 1000 * 60 * 5,
    enabled,
  });

  return { clientNames: data ?? {}, isLoading };
}
