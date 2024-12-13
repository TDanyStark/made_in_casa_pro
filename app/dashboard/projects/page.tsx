import { Metadata } from "next";
import { lusitana } from "@/app/ui/fonts";
import { CreateProject } from "@/app/ui/projects/buttons";

export const metadata: Metadata = {
  title: "Proyectos",
};
export default async function Page() {
  return (
    <section className="w-full">
      <div className="flex w-full items-center justify-between">
        <h1 className={`${lusitana.className} titleh1`}>Proyectos</h1>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 md:mt-8">
        {/* <Search placeholder="Search invoices..." />*/}
        <CreateProject /> 
      </div>
      {/* <Suspense key={query + currentPage} fallback={<InvoicesTableSkeleton />}>
        <Table query={query} currentPage={currentPage} />
      </Suspense> */}
      <div className="mt-5 flex w-full justify-center">
        {/* <Suspense key={"pagination "+ query + currentPage} fallback={<><p>Loading...</p></>}>
          <Pagination query={query} currentPage={currentPage} />
        </Suspense> */}
      </div>
    </section>
  );
}
