"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { get } from "@/lib/services/apiService";
import { ApiResponseWithPagination, BrandType, UserType } from "@/lib/definitions";
import { TrafficRowType } from "@/lib/queries/traffic";
import { ITEMS_PER_PAGE } from "@/config/constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SearchBar from "@/components/search/search";
import Pagination from "@/components/pagination/Pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { User, Briefcase, Tag, HardDrive, ExternalLink } from "lucide-react";

export function TrafficClient() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const search = searchParams.get("search") || "";
  const page = searchParams.get("page") || "1";
  const brandId = searchParams.get("brand_id") || "";
  const commercialId = searchParams.get("commercial_id") || "";

  const createQueryString = (params: Record<string, string | null>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    });
    return sp.toString();
  };

  // 1. Fetch Traffic Data
  const { data: trafficData, isLoading, isError } = useQuery({
    queryKey: ["traffic", page, search, brandId, commercialId],
    queryFn: async () => {
      const params = new URLSearchParams({ page, limit: ITEMS_PER_PAGE.toString() });
      if (search) params.set("search", search);
      if (brandId && brandId !== "all") params.set("brand_id", brandId);
      if (commercialId && commercialId !== "all") params.set("commercial_id", commercialId);
      const res = await get<ApiResponseWithPagination<TrafficRowType[]>>(`traffic?${params}`);
      if (!res.ok) throw new Error(res.error || "Error al obtener datos de tráfico");
      return res.data!;
    },
    staleTime: 1000 * 60 * 2,
  });

  // 2. Fetch Brands for filter
  const { data: brandsData } = useQuery({
    queryKey: ["brands-all"],
    queryFn: async () => {
      const res = await get<ApiResponseWithPagination<BrandType[]>>(`brands?limit=1000`);
      return res.ok ? res.data?.data || [] : [];
    },
  });

  // 3. Fetch Commercials for filter
  const { data: commercialsData } = useQuery({
    queryKey: ["commercials-all"],
    queryFn: async () => {
      const res = await get<{ data: UserType[] }>(`users/commercials`);
      return res.ok ? res.data?.data || [] : [];
    },
  });

  const trafficRows = trafficData?.data || [];
  const pageCount = trafficData?.pageCount || 1;
  const currentPage = trafficData?.currentPage || 1;
  const total = trafficData?.total || 0;

  const brands = (brandsData as BrandType[]) || [];
  const commercials = (commercialsData as UserType[]) || [];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar
          initialSearchValue={search}
          placeholder="Buscar proyecto..."
          onSearch={(v) =>
            replace(`${pathname}?${createQueryString({ page: "1", search: v || null })}`)
          }
          onReset={() =>
            replace(`${pathname}?${createQueryString({ page: null, search: null, brand_id: null, commercial_id: null })}`)
          }
        />

        <Select
          value={brandId || "all"}
          onValueChange={(v) =>
            replace(`${pathname}?${createQueryString({ page: "1", brand_id: v === "all" ? null : v })}`)
          }
        >
          <SelectTrigger className="w-48">
            <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Marca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las marcas</SelectItem>
            {brands.map((b: any) => (
              <SelectItem key={b.id} value={b.id?.toString() || ""}>
                {b.brand_name || b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={commercialId || "all"}
          onValueChange={(v) =>
            replace(`${pathname}?${createQueryString({ page: "1", commercial_id: v === "all" ? null : v })}`)
          }
        >
          <SelectTrigger className="w-56">
            <Briefcase className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Comercial" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los comerciales</SelectItem>
            {commercials.map((u) => (
              <SelectItem key={u.id} value={u.id.toString()}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proyecto / Producto</TableHead>
              <TableHead>Marca / Gerente</TableHead>
              <TableHead>Comercial</TableHead>
              <TableHead className="text-center">Avance</TableHead>
              <TableHead>Tarea Actual</TableHead>
              <TableHead>Responsable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-20 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-32" /></TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-destructive">
                  Error al cargar los datos.
                </TableCell>
              </TableRow>
            ) : trafficRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No se encontraron resultados.
                </TableCell>
              </TableRow>
            ) : (
              trafficRows.map((row) => (
                <TableRow key={row.project_id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <Link 
                        href={`/projects/${row.project_id}`}
                        className="font-medium hover:underline text-primary"
                      >
                        {row.project_title}
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {row.product_name}
                        </span>
                        {row.drive_folder_url && (
                          <a
                            href={row.drive_folder_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700 transition-colors"
                            title="Ver carpeta en Drive"
                          >
                            <HardDrive className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{row.brand_name}</span>
                      <span className="text-xs text-muted-foreground">{row.manager_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{row.commercial_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1 min-w-[100px]">
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-primary h-full transition-all" 
                          style={{ width: `${row.progress_percentage}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold">
                        {row.task_completed}/{row.task_count} ({row.progress_percentage}%)
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm line-clamp-1" title={row.current_task_title || ""}>
                      {row.current_task_title || "---"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {row.current_task_responsible_name ? (
                      <Badge variant="secondary" className="font-normal">
                        {row.current_task_responsible_name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Sin asignar</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            pageCount={pageCount}
            onPageChange={(p) =>
              replace(`${pathname}?${createQueryString({ page: p.toString() })}`)
            }
          />
        </div>
      )}
      
      <p className="text-xs text-muted-foreground text-right">
        Total: {total} registro{total !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
