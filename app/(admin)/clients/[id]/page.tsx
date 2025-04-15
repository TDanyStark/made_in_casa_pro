import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { ClientData } from "@/components/clients/ClientData";

export default function ClientPage({ params }: { params: { id: string } }) {
  return (
    <section>
      <div className="mt-6">
        <Suspense
          fallback={
            <div className="flex gap-2">
              <Skeleton className="w-10 aspect-video" />
              <Skeleton className="w-full h-[28px]" />
            </div>
          }
        >
          <ClientData id={params.id} />
        </Suspense>
      </div>
    </section>
  );
}

