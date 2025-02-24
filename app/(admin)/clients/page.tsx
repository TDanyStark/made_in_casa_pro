import CreateClientModal from "@/components/clients/CreateClientModal";
import ListClients from "@/components/clients/ListClients";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";

export default async function Page() {
  const cantidadSkeletons = 10;
  return (
    <section>
      <h1 className="primaryH1">Clientes</h1>
      <div className="mt-6">
        <CreateClientModal />
        <Suspense 
          fallback={
            <div className="py-8 grid gap-8 lg:grid-cols-3">
              {[...Array(cantidadSkeletons)].map((_, index) => (
                <Skeleton key={index} className="w-full h-[120px]" />
              ))}
            </div>
          }>
          <ListClients/>
        </Suspense>
      </div>
    </section>
  );
}
