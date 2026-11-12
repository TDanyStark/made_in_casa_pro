import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { MyQuotesClient } from "@/components/quotes/MyQuotesClient";
import { redirectInternalCollaboratorFromQuotes } from "@/lib/services/quotes-page-guard";

export default async function MyQuotesPage() {
  await redirectInternalCollaboratorFromQuotes();
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
