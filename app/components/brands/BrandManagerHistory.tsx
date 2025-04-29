"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "../ui/skeleton";
import { useFetchWithParameter } from "@/hooks/useFetchWithParameter";

type HistoryEntry = {
  id: string | number;
  brandId: string;
  previousManagerId: string | number | null;
  previousManagerName: string | null;
  newManagerId: string | number;
  newManagerName: string;
  changedAt: string;
  isCurrent?: boolean;
};

interface HistoryResponse {
  history: HistoryEntry[];
}

export default function BrandManagerHistory({ brandId }: { brandId: string }) {
  const {
    data,
    isLoading,
    error,
  } = useFetchWithParameter<HistoryResponse>({
    endpoint: "/api/brands/history",
    paramName: "brandId",
    paramValue: brandId,
    queryKey: "brandHistory",
  });

  const history = data?.history;

  if (isLoading) {
    return (
      <div className="p-4">
        <h2 className="text-2xl font-semibold">Historial de Gerentes</h2>
        <Skeleton className="h-4 w-1/2 mt-2" />
      </div>
    );
  }

  if (error || !history) {
    return (
      <div className="p-4">
        <h2 className="text-2xl font-semibold">Historial de Gerentes</h2>
        <p className="text-destructive mt-2">
          Error al cargar el historial de gerentes
        </p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-2xl font-semibold">Historial de Gerentes</h2>
        <p className="text-muted-foreground mt-2">
          No hay historial de gerentes disponible.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold">Historial de Gerentes</h2>

      <div className="space-y-4 mt-4">
        <ol className="relative border-l border-muted">
          {history.map((entry: HistoryEntry) => (
            <li key={entry.id} className="mb-6 ml-6">
              <span className="absolute flex items-center justify-center w-6 h-6 bg-primary/10 rounded-full -left-3 ring-8 ring-background">
                <CalendarClock className="w-3 h-3 text-primary" />
              </span>
              <h3 className="flex items-center mb-1 text-lg font-semibold">
                <Link 
                  href={`/managers/${entry.newManagerId}`} 
                  className="hover:underline"
                >
                  {entry.newManagerName}
                </Link>
                {entry.isCurrent && (
                  <span className="bg-primary text-primary-foreground text-sm font-medium mr-2 px-2.5 py-0.5 rounded ml-3">
                    Actual
                  </span>
                )}
              </h3>
              <time className="block mb-2 text-sm font-normal leading-none text-muted-foreground">
                {entry.changedAt !== "Current" 
                  ? format(new Date(entry.changedAt), "dd/MM/yyyy HH:mm") 
                  : "Presente"}
              </time>
              {entry.previousManagerName && (
                <p className="text-sm text-muted-foreground">
                  Gerente anterior: {" "}
                  <Link 
                    href={`/managers/${entry.previousManagerId}`}
                    className="text-primary hover:underline"
                  >
                    {entry.previousManagerName}
                  </Link>
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
