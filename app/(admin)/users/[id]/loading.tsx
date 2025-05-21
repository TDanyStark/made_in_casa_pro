import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <section>
      <Skeleton className="h-10 w-1/2" />
      <div className="mt-6">
        <Skeleton className="h-[280px] w-full max-w-[672px]" />
      </div>
    </section>
  );
}
