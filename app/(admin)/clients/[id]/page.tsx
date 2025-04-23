import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { ClientData } from "@/components/clients/ClientData";


type Props = {
  params: Promise<{ id: string }>
};

export default async function ClientPage({ params }: Props) {
  const { id } = await params;
  return (
    <section>
      <div className="mt-6">
        <Suspense
          key={id}
          fallback={
            <div className="flex gap-2">
              <Skeleton className="w-10 aspect-video" />
              <Skeleton className="w-full h-[28px]" />
            </div>
          }
        >
          <ClientData id={id} />
        </Suspense>
      </div>
    </section>
  );
}
