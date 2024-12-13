import { Metadata } from "next";
import Breadcrumbs from "@/app/ui/breadcrumbs";


export const metadata: Metadata = {
  title: "Crear Proyecto",
};
export default async function Page() {
  return (
    <section className="w-full">
      <Breadcrumbs
        breadcrumbs={[
          { label: 'Proyectos', href: '/dashboard/projects' },
          {
            label: 'Crear Proyecto',
            href: '/dashboard/projects/create',
            active: true,
          },
        ]}
      />
      <div className="mt-4 flex items-center justify-between gap-2 md:mt-8">

      </div>
    </section>
  );
}