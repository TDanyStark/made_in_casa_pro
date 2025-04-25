import { API_FLAG_URL, IMG_FLAG_EXT } from "@/config/constants";
import { ClientType } from "@/lib/definitions";
import { getClientById } from "@/lib/queries/clients";
import { TabsManagersAndBrands } from "./TabsManagersAndBrands";
import { Breadcrumbs } from "../navigation/Breadcrumbs";

/* eslint-disable @next/next/no-img-element */
export async function ClientData({ id }: { id: string }) {
  const client: ClientType | null = await getClientById(id);

  if (!client) {
    return <p>No se encontró información del cliente.</p>;
  }

  return (
    <>
      <Breadcrumbs
        customLabels={{
          [`/clients`]: "Clientes",
          [`/clients/${id}`]: client.name,
        }}
      />
      <div className="flex gap-2">
        <img
          src={`${API_FLAG_URL}${client.country?.flag}${IMG_FLAG_EXT}`}
          alt={`Bandera ${client.country?.name}`}
        />
        <h1 className="primaryH1">{client.name}</h1>
      </div>
      <div className="mt-8">
        <TabsManagersAndBrands clientId={parseInt(id)} />
      </div>
    </>
  );
}
