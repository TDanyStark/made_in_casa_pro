import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { MyQuotesClient } from "@/components/quotes/MyQuotesClient";

export default function MyQuotesPage() {
  return (
    <section className="container">
      <Breadcrumbs
        manualBreadcrumbs={[{ href: "/my-quotes", label: "Cotizaciones" }]}
      />
      <h1 className="primaryH1">Cotizaciones</h1>
      <div className="mt-6">
        <MyQuotesClient />
      </div>
    </section>
  );
}
