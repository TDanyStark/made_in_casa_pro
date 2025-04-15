"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreateManagerModal from "./CreateManagerModal";

export function TabsManagersAndBrands({ clientId }: { clientId: number }) {
  return (
    <Tabs defaultValue="managers" className="w-full">
      <TabsList className="w-full max-w-96 grid grid-cols-2">
        <TabsTrigger value="managers">Gerentes</TabsTrigger>
        <TabsTrigger value="brands">Marcas</TabsTrigger>
      </TabsList>
      <TabsContent value="managers" className="p-4 space-y-4">
        <CreateManagerModal clientId={clientId} />
      </TabsContent>
      <TabsContent value="brands" className="p-4">
        <h3>Marcas</h3>
      </TabsContent>
    </Tabs>
  );
}
