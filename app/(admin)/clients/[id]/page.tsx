/* eslint-disable @next/next/no-img-element */
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { getClientById } from "@/lib/queries/clients";
import { ClientType } from "@/lib/definitions";
import { API_FLAG_URL, IMG_FLAG_EXT } from "@/config/constants";

export default async function ClientPage({ params }: { params: { id: string } }) {
  const client: ClientType | null = await getClientById(params.id);

  return (
    <section>
      <h1 className="primaryH1">Información del Cliente</h1>
      <div className="mt-6">
        <Suspense
          fallback={
            <div className="mt-6">
              <Skeleton className="w-72 h-[36px]" />
              <Skeleton className="w-full h-[120px] mt-4" />
            </div>
          }
        >
          {client ? (
            <div>
              <img src={`${API_FLAG_URL}${client.country?.flag}${IMG_FLAG_EXT}`} alt={`Bandera ${client.country?.name}`} />
              <h2 className="text-xl font-bold">{client.name}</h2>
            </div>
          ) : (
            <p>No se encontró información del cliente.</p>
          )}
        </Suspense>
      </div>
    </section>
  );
}