"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreateManagerModal from "@/components/managers/CreateManagerModal";
import { Button } from "../ui/button";
import CreateBrandModal from "./CreateBrandModal";
import { useState } from "react";
import ListManagersClient from "../managers/ListManagersClient";
import ListBrandsClient from "./ListBrandsClient";
import { useSearchParams, usePathname, useRouter } from "next/navigation";

export function TabsManagersAndBrands({ clientId}: { clientId: number; }) {
  const [openManagerModal, setOpenManagerModal] = useState(false);
  const [openBrandModal, setOpenBrandModal] = useState(false);

  // Obtener los parámetros de la URL y configuración para actualizarla
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  
  // Obtener el tab actual de la URL o usar "managers" como valor predeterminado
  const currentTab = searchParams.get("tab") || "managers";

  const handleManagerModal = (state: boolean) => {
    setOpenManagerModal(state);
  };

  const handleBrandModal = (state: boolean) => {
    setOpenBrandModal(state);
  };
  
  // Función para actualizar la URL cuando cambia la pestaña
  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    console.log("params", params.toString());
    params.set("tab", value);
    replace(`${pathname}?${params.toString()}`);
  };

  return (
    <Tabs defaultValue={currentTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger 
          value="managers" 
          className="select-none data-[state=active]:bg-primary/10 dark:data-[state=active]:bg-primary/20"
        >
          Gerentes
        </TabsTrigger>
        <TabsTrigger 
          value="brands"
          className="select-none data-[state=active]:bg-primary/10 dark:data-[state=active]:bg-primary/20"
        >
          Marcas
        </TabsTrigger>
      </TabsList>
      <TabsContent value="managers" className="p-4">
        <Button variant="default" onClick={() => handleManagerModal(true)}>
          Crear gerente
        </Button>
        <CreateManagerModal
          clientId={clientId}
          openModal={openManagerModal}
          handleModal={handleManagerModal}
        />
        <ListManagersClient clientId={clientId.toString()} />
      </TabsContent>
      <TabsContent value="brands" className="p-4">
        <Button variant="default" onClick={() => handleBrandModal(true)}>
          Crear marca
        </Button>
        <CreateBrandModal
          clientId={clientId}
          openModal={openBrandModal}
          handleModal={handleBrandModal}
        />
        <ListBrandsClient clientId={clientId.toString()} />
      </TabsContent>
    </Tabs>
  );
}
