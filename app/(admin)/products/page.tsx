import ListProductsClient from "@/components/products/ListProductsClient";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";

export default function Page() {
  return (
    <section className="container">
      <Breadcrumbs
        manualBreadcrumbs={[{ href: "/products", label: "Productos" }]}
      />
      <h1 className="primaryH1">Todos los productos</h1>
      <div className="mt-6">
        <ListProductsClient />
      </div>
    </section>
  );
}
