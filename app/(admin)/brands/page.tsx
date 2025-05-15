import ListBrandsClient from "@/components/clients/ListBrandsClient";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";


export default function Page() {
  
  return (
    <section className="container">
      <Breadcrumbs
        manualBreadcrumbs={[
          { href: "/clients", label: "Clientes" },
          { href: "/brands", label: "Marcas" },
        ]}
      />
      <h1 className="primaryH1">Todas las marcas</h1>
      <div className="mt-6">
        <ListBrandsClient />
      </div>
      
    </section>
  );
}