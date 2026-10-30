"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { get } from "@/lib/services/apiService";
import {
  ProjectType,
  ApiResponseWithPagination,
  BrandType,
  ClientType,
  ManagerType,
  UserType,
} from "@/lib/definitions";
import { ITEMS_PER_PAGE } from "@/config/constants";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import SearchBar from "@/components/search/search";
import Pagination from "@/components/pagination/Pagination";
import { buildCreatorFilterOptions } from "@/lib/utils/project-filters";
import { ProjectCard } from "./ProjectCard";
import { Plus, FolderOpen } from "lucide-react";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos los estados" },
  { value: "active", label: "Activos" },
  { value: "paused", label: "Pausados" },
  { value: "completed", label: "Completados" },
  { value: "archived", label: "Archivados" },
];

/** Parámetros de la URL que actúan como filtro de la lista. */
const FILTER_KEYS = ["search", "status", "client_id", "brand_id", "manager_id", "created_by"] as const;

interface Props {
  canCreate: boolean;
  canSeeCreator?: boolean;
  /** El comercial solo ve sus propios proyectos, así que no filtra por creador. */
  canFilterByCreator?: boolean;
}

async function fetchList<T>(endpoint: string): Promise<T[]> {
  const res = await get<{ data: T[] }>(endpoint);
  if (!res.ok) throw new Error(res.error);
  return res.data?.data || [];
}

export function ListProjectsClient({ canCreate, canSeeCreator = false, canFilterByCreator = false }: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const search = searchParams.get("search") || "";
  const page = searchParams.get("page") || "1";
  const status = searchParams.get("status") || "";
  const clientId = searchParams.get("client_id") || "";
  const brandId = searchParams.get("brand_id") || "";
  const managerId = searchParams.get("manager_id") || "";
  const createdBy = canFilterByCreator ? searchParams.get("created_by") || "" : "";
  const hasFilters = Boolean(search || status || clientId || brandId || managerId || createdBy);

  const createQueryString = (params: Record<string, string | null>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    });
    return sp.toString();
  };

  const setFilter = (params: Record<string, string | null>) =>
    replace(`${pathname}?${createQueryString({ page: "1", ...params })}`);

  const clearFilters = () =>
    replace(
      `${pathname}?${createQueryString({
        page: null,
        ...Object.fromEntries(FILTER_KEYS.map((key) => [key, null])),
      })}`
    );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["projects", page, search, status, clientId, brandId, managerId, createdBy],
    queryFn: async () => {
      const params = new URLSearchParams({ page, limit: ITEMS_PER_PAGE.toString() });
      if (search) params.set("search", search);
      if (status && status !== "all") params.set("status", status);
      if (clientId) params.set("client_id", clientId);
      if (brandId) params.set("brand_id", brandId);
      if (managerId) params.set("manager_id", managerId);
      if (createdBy) params.set("created_by", createdBy);
      const res = await get<ApiResponseWithPagination<ProjectType[]>>(`projects?${params}`);
      if (!res.ok) throw new Error(res.error || "Error al obtener proyectos");
      return res.data!;
    },
    staleTime: 1000 * 60 * 2,
  });

  // Opciones de los filtros. Marca y gerente se acotan al cliente elegido.
  const clientScope = clientId ? `&client_id=${clientId}` : "";

  const { data: clients = [], isError: clientsError } = useQuery({
    queryKey: ["project-filter-clients"],
    queryFn: () => fetchList<ClientType>("clients?limit=500"),
  });

  const { data: brands = [], isError: brandsError } = useQuery({
    queryKey: ["project-filter-brands", clientId],
    queryFn: () => fetchList<BrandType>(`brands?limit=500${clientScope}`),
  });

  const { data: managers = [], isError: managersError } = useQuery({
    queryKey: ["project-filter-managers", clientId],
    queryFn: () => fetchList<ManagerType>(`managers?limit=200${clientScope}`),
  });

  const { data: creators = [], isError: creatorsError } = useQuery({
    queryKey: ["project-filter-creators"],
    queryFn: () => fetchList<UserType>("users/commercials"),
    enabled: canFilterByCreator,
  });

  const creatorOptions = useMemo(() => buildCreatorFilterOptions(creators), [creators]);

  const toOptions = (items: { id?: number; name: string }[]) =>
    items.map((item) => ({ value: String(item.id), label: item.name }));

  const projects = (data as unknown as { data: ProjectType[] })?.data ?? [];
  const pageCount = (data as unknown as { pageCount: number })?.pageCount ?? 1;
  const currentPage = (data as unknown as { currentPage: number })?.currentPage ?? 1;
  const total = (data as unknown as { total: number })?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <SearchBar
            initialSearchValue={search}
            placeholder="Buscar por nombre del proyecto..."
            onSearch={(v) => setFilter({ search: v || null })}
            onReset={clearFilters}
          />
          <Select
            value={status || "all"}
            onValueChange={(v) => setFilter({ status: v === "all" ? null : v })}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canCreate && (
          <Button asChild>
            <Link href="/projects/create">
              <Plus className="h-4 w-4 mr-1.5" />
              Crear proyecto
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <SearchableSelect
          value={clientId || "all"}
          onValueChange={(v) =>
            // Al cambiar de cliente, la marca y el gerente elegidos pueden no pertenecerle
            setFilter({ client_id: v === "all" ? null : v, brand_id: null, manager_id: null })
          }
          options={[{ value: "all", label: "Cliente: todos" }, ...toOptions(clients)]}
          placeholder="Cliente"
          searchPlaceholder="Buscar cliente..."
          emptyMessage={clientsError ? "Error al cargar los clientes." : "Sin clientes."}
        />
        <SearchableSelect
          value={brandId || "all"}
          onValueChange={(v) => setFilter({ brand_id: v === "all" ? null : v })}
          options={[{ value: "all", label: "Marca: todas" }, ...toOptions(brands)]}
          placeholder="Marca"
          searchPlaceholder="Buscar marca..."
          emptyMessage={brandsError ? "Error al cargar las marcas." : "Sin marcas."}
        />
        <SearchableSelect
          value={managerId || "all"}
          onValueChange={(v) => setFilter({ manager_id: v === "all" ? null : v })}
          options={[{ value: "all", label: "Gerente: todos" }, ...toOptions(managers)]}
          placeholder="Gerente"
          searchPlaceholder="Buscar gerente..."
          emptyMessage={managersError ? "Error al cargar los gerentes." : "Sin gerentes."}
        />
        {canFilterByCreator && (
          <SearchableSelect
            value={createdBy || "all"}
            onValueChange={(v) => setFilter({ created_by: v === "all" ? null : v })}
            options={[{ value: "all", label: "Creado por: todos" }, ...creatorOptions]}
            placeholder="Creado por"
            searchPlaceholder="Buscar usuario..."
            emptyMessage={creatorsError ? "Error al cargar los usuarios." : "Sin usuarios."}
          />
        )}
        {hasFilters && (
          <Button variant="outline" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {isError ? (
        <div className="text-center py-8 text-destructive">Error al cargar los proyectos</div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">
            {hasFilters ? "No se encontraron proyectos con esos filtros." : "Aún no hay proyectos creados."}
          </p>
          {canCreate && (
            <Button asChild className="mt-4">
              <Link href="/projects/create">Crear el primer proyecto</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{total} proyecto{total !== 1 ? "s" : ""}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} showCreator={canSeeCreator} />
            ))}
          </div>
        </>
      )}

      {pageCount > 1 && (
        <Pagination
          currentPage={currentPage}
          pageCount={pageCount}
          onPageChange={(p) =>
            replace(`${pathname}?${createQueryString({ page: p.toString() })}`)
          }
        />
      )}
    </div>
  );
}
