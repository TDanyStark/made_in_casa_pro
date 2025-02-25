import CreateClientModal from "@/components/clients/CreateClientModal";
import ListClientsInput from "@/components/clients/ListClientsInput";
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
            <div className="mt-6">
              <Skeleton className="w-72 h-[36px]" />
              <div className="py-4 grid gap-8 lg:grid-cols-3">
                {[...Array(cantidadSkeletons)].map((_, index) => (
                  <Skeleton key={index} className="w-full h-[120px]" />
                ))}
              </div>
            </div>
          }>
          <ListClientsInput />
        </Suspense>
      </div>
    </section>
  );
}
