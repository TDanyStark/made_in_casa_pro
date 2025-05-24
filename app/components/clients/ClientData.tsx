import { API_FLAG_URL, IMG_FLAG_EXT } from "@/config/constants";
import { ClientType } from "@/lib/definitions";
import { getClientById } from "@/lib/queries/clients";
import { TabsManagersAndBrands } from "./TabsManagersAndBrands";
import { Breadcrumbs } from "../navigation/Breadcrumbs";
import CheckboxChangeState from "../checkbox/CheckboxChangeState";

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
      <div className="flex gap-2 items-end">
        <img
          src={`${API_FLAG_URL}${client.country?.flag}${IMG_FLAG_EXT}`}
          alt={`Bandera ${client.country?.name}`}
        />
        <h1 className="primaryH1">{client.name}</h1>
      </div>
      <div className="mt-4">
        <CheckboxChangeState
          label="Aceptar unidades de negocio"
          initialChecked={client.accept_business_units || false}
          endpoint={`clients/${id}`}
          fieldName="accept_business_units"
        />
      </div>
      <div className="mt-8">
        <TabsManagersAndBrands clientId={parseInt(id)} />
      </div>
    </>
  );
}
