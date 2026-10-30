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
import { AsyncSearchableSelect } from "@/components/ui/async-searchable-select";
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

/** Filas de `GET /api/clients` y `GET /api/managers`. */
type NamedRow = { id: number; name: string };
/** Filas de `GET /api/brands` (lista paginada): el nombre viene como `brand_name`. */
type BrandRow = { id: number; brand_name: string };

const getName = (row: NamedRow) => row.name;
const getBrandName = (row: BrandRow) => row.brand_name;

/** `GET /api/brands?id=X` devuelve la marca con `name`; sirve para un id que llega por URL. */
async function fetchBrandLabel(id: string): Promise<string | undefined> {
  const res = await get<BrandType>(`brands?id=${id}`);
  if (!res.ok) throw new Error(res.error);
  return res.data?.name;
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

  // Marca y gerente se buscan dentro del cliente elegido.
  const clientScope = { client_id: clientId || undefined };

  const { data: creators = [], isError: creatorsError } = useQuery({
    queryKey: ["project-filter-creators"],
    queryFn: () => fetchList<UserType>("users/commercials"),
    enabled: canFilterByCreator,
  });

  const creatorOptions = useMemo(() => buildCreatorFilterOptions(creators), [creators]);

  const projects = (data as unknown as { data: ProjectType[] })?.data ?? [];
  const pageCount = (data as unknown as { pageCount: number })?.pageCount ?? 1;
  const currentPage = (data as unknown as { currentPage: number })?.currentPage ?? 1;
  const total = (data as unknown as { total: number })?.total ?? 0;

  // Etiqueta de respaldo para un cliente/gerente que llega por URL: al filtrar por
  // él, todas las filas comparten ese cliente (projects.client_id) y ese gerente
  // (gerente de la marca principal).
  const clientLabel = clientId ? projects[0]?.client_name || "Cliente seleccionado" : undefined;
  const managerLabel = managerId ? projects[0]?.manager_name || "Gerente seleccionado" : undefined;

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
        <AsyncSearchableSelect<NamedRow>
          endpoint="clients"
          getLabel={getName}
          value={clientId || "all"}
          onValueChange={(v) =>
            // Al cambiar de cliente, la marca y el gerente elegidos pueden no pertenecerle
            setFilter({ client_id: v === "all" ? null : v, brand_id: null, manager_id: null })
          }
          allOption={{ value: "all", label: "Cliente: todos" }}
          selectedLabel={clientLabel}
          placeholder="Cliente"
          searchPlaceholder="Buscar cliente..."
          emptyMessage="Sin clientes."
          errorMessage="Error al cargar los clientes."
        />
        <AsyncSearchableSelect<BrandRow>
          endpoint="brands"
          params={clientScope}
          getLabel={getBrandName}
          value={brandId || "all"}
          onValueChange={(v) => setFilter({ brand_id: v === "all" ? null : v })}
          allOption={{ value: "all", label: "Marca: todas" }}
          fetchSelectedLabel={fetchBrandLabel}
          placeholder="Marca"
          searchPlaceholder="Buscar marca..."
          emptyMessage="Sin marcas."
          errorMessage="Error al cargar las marcas."
        />
        <AsyncSearchableSelect<NamedRow>
          endpoint="managers"
          params={clientScope}
          getLabel={getName}
          value={managerId || "all"}
          onValueChange={(v) => setFilter({ manager_id: v === "all" ? null : v })}
          allOption={{ value: "all", label: "Gerente: todos" }}
          selectedLabel={managerLabel}
          placeholder="Gerente"
          searchPlaceholder="Buscar gerente..."
          emptyMessage="Sin gerentes."
          errorMessage="Error al cargar los gerentes."
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
