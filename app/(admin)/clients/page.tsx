import ListClientsClient from "@/components/clients/ListClientsClient";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";

export default function ClientsPage() {
  return (
    <section className="container">
      <Breadcrumbs
        manualBreadcrumbs={[
          { href: "/clients", label: "Clientes" },
        ]}
      />
      <h1 className="primaryH1">Todos los Clientes</h1>
      <div className="mt-6">
        <ListClientsClient />
      </div>
    </section>
  );
}
