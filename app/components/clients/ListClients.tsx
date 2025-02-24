/* eslint-disable @next/next/no-img-element */
import { CardContent } from "@/components/ui/card";
import { Building, ExternalLink } from "lucide-react";

import { ClientType } from "@/lib/definitions";
import Link from "next/link";
import { fetchFilteredClientsAction } from "@/lib/actions/clientsActions";
import { API_FLAG_URL, IMG_FLAG_EXT } from "@/config/constants";

const ListClients = async () => {
  const response = await fetchFilteredClientsAction();
  const clientes = response.clients as unknown as ClientType[];

  return (
    <>
      
      <div className="mx-auto py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {clientes.map((client: ClientType) => (
            <Link
              className="border border-muted-foreground rounded-md group hover:border-market-green transition-colors duration-300"
              href={`/clients/${client.id}`}
              key={client.id}
            >
              <CardContent className="p-6 relative">
                <ExternalLink
                  strokeWidth={1.2}
                  className="absolute top-3 right-3 text-muted-foreground transition-opacity duration-300 opacity-0 group-hover:text-market-green group-hover:opacity-100"
                />
                <div className="block group">
                  <div className="flex items-center mb-2">
                    <Building className="h-8 w-8 mr-2 text-market-green" />
                    <h2 className="text-2xl font-semibold truncate whitespace-nowrap overflow-hidden">
                      {client.name}
                    </h2>
                  </div>
                  <div className="flex items-center pl-1">
                    <img
                      src={`${API_FLAG_URL}${client.country_flag}${IMG_FLAG_EXT}`}
                      alt={`Bandera de ${client.country_name}`}
                      width="20"
                      height="15"
                      className="mr-2"
                    />
                    <span className="text-lg text-muted-foreground">
                      {client.country_name}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
};

export default ListClients;
