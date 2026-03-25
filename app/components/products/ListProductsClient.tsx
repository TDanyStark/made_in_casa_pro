"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Pagination from "@/components/pagination/Pagination";
import SearchBar from "@/components/search/search";
import TableProducts from "./TableProducts";
import CreateProductModal from "./CreateProductModal";
import { get } from "@/lib/services/apiService";
import { ProductType, ApiResponseWithPagination, ProductCategoryType } from "@/lib/definitions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ListProductsClient() {
  const [openModal, setOpenModal] = useState(false);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const search = searchParams.get("search") || "";
  const page = searchParams.get("page") || "1";
  const categoryId = searchParams.get("category_id") || "";
  const isActive = searchParams.get("is_active") || "";

  const createQueryString = (params: Record<string, string | null>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    });
    return sp.toString();
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["products", page, search, categoryId, isActive],
    queryFn: async () => {
      const params = new URLSearchParams({ page });
      if (search) params.set("search", search);
      if (categoryId) params.set("category_id", categoryId);
      if (isActive !== "") params.set("is_active", isActive);
      const res = await get<ApiResponseWithPagination<ProductType[]>>(`products?${params}`);
      if (!res.ok) throw new Error(res.error || "Error al obtener productos");
      return res.data!;
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["product-categories-all"],
    queryFn: async () => {
      const res = await get<ProductCategoryType[]>("product-categories?all=true");
      return res.ok ? (res.data ?? []) : [];
    },
  });

  const products = data?.data ?? [];
  const pageCount = data?.pageCount ?? 1;
  const currentPage = data?.currentPage ?? 1;

  return (
    <div className="space-y-4">
      {isError ? (
        <div className="text-center py-4 text-red-500">Error al cargar los productos</div>
      ) : (
        <Card className="mt-4">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Todos los Productos</CardTitle>
              <Button variant="default" onClick={() => setOpenModal(true)}>
                Crear Producto
              </Button>
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
              <SearchBar
                initialSearchValue={search}
                placeholder="Buscar productos..."
                onSearch={(v) =>
                  replace(`${pathname}?${createQueryString({ page: "1", search: v || null })}`)
                }
                onReset={() =>
                  replace(
                    `${pathname}?${createQueryString({ page: null, search: null, category_id: null, is_active: null })}`
                  )
                }
              />
              <Select
                value={categoryId || "all"}
                onValueChange={(v) =>
                  replace(
                    `${pathname}?${createQueryString({ page: "1", category_id: v === "all" ? null : v })}`
                  )
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={isActive !== "" ? isActive : "all"}
                onValueChange={(v) =>
                  replace(
                    `${pathname}?${createQueryString({ page: "1", is_active: v === "all" ? null : v })}`
                  )
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="1">Activos</SelectItem>
                  <SelectItem value="0">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[404px] w-full" />
            ) : (
              <TableProducts products={products} pageCount={pageCount} />
            )}
            <Pagination
              currentPage={currentPage}
              pageCount={pageCount}
              onPageChange={(p) =>
                replace(`${pathname}?${createQueryString({ page: p.toString(), search: search || null })}`)
              }
            />
          </CardContent>
        </Card>
      )}

      <CreateProductModal openModal={openModal} handleModal={setOpenModal} />
    </div>
  );
}
