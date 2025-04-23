"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreateManagerModal from "./CreateManagerModal";
import { Button } from "../ui/button";
import CreateBrandModal from "./CreateBrandModal";
import { useState } from "react";
import ListManagersClient from "./ListManagersClient";

export function TabsManagersAndBrands({ clientId }: { clientId: number }) {
  const [openManagerModal, setOpenManagerModal] = useState(false);
  const [openBrandModal, setOpenBrandModal] = useState(false);

  const handleManagerModal = (state: boolean) => {
    setOpenManagerModal(state);
  };

  const handleBrandModal = (state: boolean) => {
    setOpenBrandModal(state);
  };

  return (
    <Tabs defaultValue="managers">
      <TabsList>
        <TabsTrigger value="managers">Gerentes</TabsTrigger>
        <TabsTrigger value="brands">Marcas</TabsTrigger>
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
          // clientId={clientId}
          openModal={openBrandModal}
          handleModal={handleBrandModal}
        />
      </TabsContent>
    </Tabs>
  );
}
