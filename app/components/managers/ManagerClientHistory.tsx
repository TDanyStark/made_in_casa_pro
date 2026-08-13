"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { get } from "@/lib/services/apiService";
import { ManagerClientHistoryEntry } from "@/lib/definitions";

interface HistoryResponse {
  history: ManagerClientHistoryEntry[];
}

/**
 * Trayectoria del gerente entre clientes. Espeja el timeline de
 * `BrandManagerHistory`, pero de cliente en vez de marca.
 */
export default function ManagerClientHistory({
  managerId,
}: {
  managerId: number;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["manager-history", managerId],
    queryFn: async () => {
      const res = await get<HistoryResponse>(`managers/${managerId}/history`);
      if (!res.ok) throw new Error(res.error);
      return res.data as unknown as HistoryResponse;
    },
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="p-4">
        <h2 className="text-2xl font-semibold">Trayectoria</h2>
        <Skeleton className="h-4 w-1/2 mt-2" />
      </div>
    );
  }

  const history = data?.history ?? [];

  // Sin traslados no hay nada que contar: no ensuciamos la ficha con un bloque
  // vacío.
  if (isError || history.length === 0) return null;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold">Trayectoria</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Traslados de este gerente entre clientes.
      </p>

      <ol className="relative border-l border-muted mt-4">
        {history.map((entry) => (
          <li key={entry.id} className="mb-6 ml-6">
            <span className="absolute flex items-center justify-center w-6 h-6 bg-primary/10 rounded-full -left-3 ring-8 ring-background">
              <CalendarClock className="w-3 h-3 text-primary" />
            </span>
            <h3 className="flex flex-wrap items-center gap-2 mb-1 text-base font-semibold">
              {entry.previousClientId ? (
                <Link
                  href={`/clients/${entry.previousClientId}`}
                  className="hover:underline"
                >
                  {entry.previousClientName ?? "Cliente anterior"}
                </Link>
              ) : (
                <span>{entry.previousClientName ?? "Sin cliente"}</span>
              )}
              <span aria-hidden className="text-muted-foreground">
                →
              </span>
              <Link
                href={`/clients/${entry.newClientId}`}
                className="hover:underline"
              >
                {entry.newClientName ?? "Cliente"}
              </Link>
            </h3>
            <time className="block mb-1 text-sm font-normal leading-none text-muted-foreground">
              {format(new Date(entry.changedAt), "dd/MM/yyyy HH:mm")}
            </time>
            {entry.changedByName && (
              <p className="text-sm text-muted-foreground">
                Registrado por {entry.changedByName}
              </p>
            )}
            {entry.reason && (
              <p className="text-sm text-muted-foreground">
                Motivo: {entry.reason}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
