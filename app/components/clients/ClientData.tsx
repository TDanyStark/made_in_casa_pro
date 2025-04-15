import { API_FLAG_URL, IMG_FLAG_EXT } from "@/config/constants";
import { ClientType } from "@/lib/definitions";
import { getClientById } from "@/lib/queries/clients";

/* eslint-disable @next/next/no-img-element */
export async function ClientData({ id }: { id: string }) {
  const client: ClientType | null = await getClientById(id);

  if (!client) {
    return <p>No se encontró información del cliente.</p>;
  }

  return (
    <div className="flex gap-2">
      <img
        src={`${API_FLAG_URL}${client.country?.flag}${IMG_FLAG_EXT}`}
        alt={`Bandera ${client.country?.name}`}
      />
      <h2 className="text-xl font-bold">{client.name}</h2>
    </div>
  );
}