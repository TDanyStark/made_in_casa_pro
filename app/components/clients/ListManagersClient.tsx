"use client";

import { useManagersQuery } from "@/hooks/useManagersQuery";
// import ListManager from "./ListManager";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
// import { ManagerType } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Pagination from "@/components/pagination/Pagination";
import SearchBar from "@/components/search/search";
import TableManagers from "./TableManagers";
import { Skeleton } from "../ui/skeleton";

interface ManagerTableClientProps {
  clientId?: string;
  endpoint?: string; // Nuevo parámetro para especificar el endpoint
  searchQuery?: string;
}

export default function ListManagersClient({
  clientId,
  endpoint = "managers",
}: ManagerTableClientProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const search = searchParams.get("search") || "";
  const page = searchParams.get("page") || "1";

  // Utilizar React Query para obtener los managers
  const { data, isLoading, isError } = useManagersQuery({
    clientId,
    page,
    search,
    endpoint, // Ahora podemos pasar el endpoint dinámicamente
  });

  // Valores predeterminados si hay error o está cargando
  const managers = data?.managers || [];
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
          Error al cargar los {endpoint}
        </div>
      ) : (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>
              {clientId ? "Gerentes del Cliente" : "Todos los Gerentes"}
            </CardTitle>
            <SearchBar
              initialSearchValue={search}
              placeholder="Buscar gerentes..."
              onSearch={handleSearch}
              onReset={handleReset}
            />
          </CardHeader>
          <CardContent>
            {
              isLoading ? (
                <Skeleton className="h-[404px] w-full" />
              ) : (
                <TableManagers managers={managers} pageCount={pageCount} />
              )
            }

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
