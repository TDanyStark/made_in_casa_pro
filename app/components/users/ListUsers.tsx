"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Pagination from "@/components/pagination/Pagination";
import SearchBar from "@/components/search/search";
import { useQuery } from "@tanstack/react-query";
import CreateUserModal from "./CreateUserModal";
import TableUsers from "./TableUsers";

export default function ListUsers() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const search = searchParams.get("search") || "";
  const page = searchParams.get("page") || "1";

  // Consulta para obtener usuarios con búsqueda y paginación
  const { data, isLoading, isError } = useQuery({
    queryKey: ["users", { page, search }],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (search) queryParams.set("search", search);
      if (page) queryParams.set("page", page);
      
      const response = await fetch(`/api/users?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error("Error al cargar usuarios");
      }
      const data = await response.json();
      return data;
    },
  });

  // Valores predeterminados si hay error o está cargando
  const users = data?.data || [];
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
      <div className="flex justify-end">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Crear usuario
        </button>
      </div>

      {isError ? (
        <div className="text-center py-4 text-red-500">
          Error al cargar los usuarios
        </div>
      ) : (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Todos los Usuarios</CardTitle>
            <SearchBar
              initialSearchValue={search}
              placeholder="Buscar usuarios..."
              onSearch={handleSearch}
              onReset={handleReset}
            />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[404px] w-full" />
            ) : (
              <TableUsers users={users} />
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

      <CreateUserModal
        isOpen={isCreateModalOpen}
        setIsOpen={setIsCreateModalOpen}
      />
    </div>
  );
}
