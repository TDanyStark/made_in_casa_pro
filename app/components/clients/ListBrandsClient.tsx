"use client";

import { useGetEndpointQuery } from "@/hooks/useGetEndpointQuery";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Pagination from "@/components/pagination/Pagination";
import SearchBar from "@/components/search/search";
import TableBrands from "./TableBrands";
import { Skeleton } from "../ui/skeleton";
import { BrandType } from "@/lib/definitions";

interface BrandTableClientProps {
  clientId?: string;
  endpoint?: string;
  searchQuery?: string;
}

export default function ListBrandsClient({
  clientId,
  endpoint = "brands",
}: BrandTableClientProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const search = searchParams.get("search") || "";
  const page = searchParams.get("page") || "1";

  // Utilizar React Query para obtener las marcas
  const { data, isLoading, isError } = useGetEndpointQuery<BrandType>({
    clientId,
    page,
    search,
    endpoint,
  });

  // Valores predeterminados si hay error o está cargando
  const brands = data?.data || [];
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
          Error al cargar las marcas
        </div>
      ) : (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>
              {clientId ? "Marcas del Cliente" : "Todas las Marcas"}
            </CardTitle>
            <SearchBar
              initialSearchValue={search}
              placeholder="Buscar marcas..."
              onSearch={handleSearch}
              onReset={handleReset}
            />
          </CardHeader>
          <CardContent>
            {
              isLoading ? (
                <Skeleton className="h-[404px] w-full" />
              ) : (
                <TableBrands brands={brands} pageCount={pageCount} />
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