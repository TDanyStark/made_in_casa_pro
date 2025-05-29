"use client";

import { useGetEndpointQueryClient } from "@/hooks/useGetEndpointQueryClient";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Pagination from "@/components/pagination/Pagination";
import SearchBar from "@/components/search/search";
import TableClients from "./TableClients";
import { Skeleton } from "../ui/skeleton";
import { ClientType } from "@/lib/definitions";
import CreateClientModal from "./CreateClientModal";

interface ClientTableClientProps {
  endpoint?: string;
}

export default function ListClientsClient({
  endpoint = "clients",
}: ClientTableClientProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const search = searchParams.get("search") || "";
  const page = searchParams.get("page") || "1";

  // Utilizar React Query para obtener los clientes
  const { data, isLoading, isError } = useGetEndpointQueryClient<ClientType>({
    page,
    search,
    endpoint,
  });

  // Valores predeterminados si hay error o está cargando
  const clients = data?.data || [];
  const pageCount = data?.pageCount || 1;
  const currentPage = data?.currentPage || 1;

  // Function to create a new URLSearchParams with updated parameters
  const createQueryString = (
    params: Record<string, string | number | null>
  ) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());

    // Update search params based on provided params
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) {
        newSearchParams.delete(key);
      } else {
        newSearchParams.set(key, String(value));
      }
    });

    return newSearchParams.toString();
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    replace(
      `${pathname}?${createQueryString({
        page: page,
        search: search || null,
      })}`
    );
  };

  // Handle search
  const handleSearch = (searchValue: string) => {
    replace(
      `${pathname}?${createQueryString({ page: 1, search: searchValue })}`
    );
  };

  // Handle reset
  const handleReset = () => {
    replace(`${pathname}?${createQueryString({ page: null, search: null })}`);
  };

  return (
    <div className="space-y-4">
      {isError ? (
        <div className="text-center py-4 text-red-500">
          Error al cargar los clientes
        </div>
      ) : (        <Card className="mt-4">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Todos los Clientes</CardTitle>
              <CreateClientModal />
            </div>
            <SearchBar
              initialSearchValue={search}
              placeholder="Buscar clientes..."
              onSearch={handleSearch}
              onReset={handleReset}
            />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[404px] w-full" />
            ) : (
              <TableClients clients={clients} pageCount={pageCount} />
            )}

            {/* Usar el componente de paginación */}
            <Pagination
              currentPage={currentPage}
              pageCount={pageCount}
              onPageChange={handlePageChange}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
