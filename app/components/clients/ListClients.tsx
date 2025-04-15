/* eslint-disable @next/next/no-img-element */
"use client";

import { API_FLAG_URL, IMG_FLAG_EXT } from "@/config/constants";
import { ClientType } from "@/lib/definitions";
import { CardContent } from "../ui/card";
import { Building, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Input } from "../ui/input";

const ListClients = ({
  clients,
}: {
  clients: ClientType[];
}) => {
  const [search, setSearch] = useState("");

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(search.toLowerCase()) || (client.country?.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return(
  <>
    <div className="mt-6">
      <Input
        type="search"
        placeholder="Buscar cliente"
        className="w-full max-w-72"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>
    <div className="mx-auto py-4">
      <div className="grid gap-8 lg:grid-cols-3">
        {filteredClients.map((client) => (
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
                    src={`${API_FLAG_URL}${client.country?.flag}${IMG_FLAG_EXT}`}
                    alt={`Bandera de ${client.country?.name}`}
                    width="20"
                    height="15"
                    className="mr-2"
                  />
                  <span className="text-lg text-muted-foreground">
                    {client.country?.name}
                  </span>
                </div>
              </div>
            </CardContent>
          </Link>
        ))}
      </div>
    </div>
  </>
  )
};

export default ListClients;
