"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { get } from "@/lib/services/apiService";
import { ProjectType, ApiResponseWithPagination } from "@/lib/definitions";
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
import SearchBar from "@/components/search/search";
import Pagination from "@/components/pagination/Pagination";
import { ProjectCard } from "./ProjectCard";
import { Plus, FolderOpen } from "lucide-react";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos los estados" },
  { value: "active", label: "Activos" },
  { value: "paused", label: "Pausados" },
  { value: "completed", label: "Completados" },
  { value: "archived", label: "Archivados" },
];

interface Props {
  canCreate: boolean;
  canSeeCreator?: boolean;
}

export function ListProjectsClient({ canCreate, canSeeCreator = false }: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const search = searchParams.get("search") || "";
  const page = searchParams.get("page") || "1";
  const status = searchParams.get("status") || "";

  const createQueryString = (params: Record<string, string | null>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    });
    return sp.toString();
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["projects", page, search, status],
    queryFn: async () => {
      const params = new URLSearchParams({ page, limit: ITEMS_PER_PAGE.toString() });
      if (search) params.set("search", search);
      if (status && status !== "all") params.set("status", status);
      const res = await get<ApiResponseWithPagination<ProjectType[]>>(`projects?${params}`);
      if (!res.ok) throw new Error(res.error || "Error al obtener proyectos");
      return res.data!;
    },
    staleTime: 1000 * 60 * 2,
  });

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
            placeholder="Buscar proyectos..."
            onSearch={(v) =>
              replace(`${pathname}?${createQueryString({ page: "1", search: v || null })}`)
            }
            onReset={() =>
              replace(`${pathname}?${createQueryString({ page: null, search: null, status: null })}`)
            }
          />
          <Select
            value={status || "all"}
            onValueChange={(v) =>
              replace(`${pathname}?${createQueryString({ page: "1", status: v === "all" ? null : v })}`)
            }
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
            {search || status ? "No se encontraron proyectos con esos filtros." : "Aún no hay proyectos creados."}
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
