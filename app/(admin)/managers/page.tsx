import ListManagersClient from "@/components/managers/ListManagersClient";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";

export default function ManagersPage() {
  return (
    <section className="container">
      <Breadcrumbs
        manualBreadcrumbs={[
          { href: "/clients", label: "Clientes" },
          { href: "/managers", label: "Gerentes" },
        ]}
      />
      <h1 className="primaryH1">Todos los Gerentes</h1>

      <div className="mt-6">
        <ListManagersClient />
      </div>
    </section>
  );
}
