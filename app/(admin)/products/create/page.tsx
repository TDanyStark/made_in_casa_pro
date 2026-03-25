import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import CreateProductForm from "@/components/products/CreateProductForm";

export default function CreateProductPage() {
  return (
    <section>
      <Breadcrumbs
        manualBreadcrumbs={[
          { href: "/products", label: "Productos" },
          { href: "/products/create", label: "Crear producto" },
        ]}
      />
      <h1 className="primaryH1">Crear producto</h1>
      <div className="mt-6 max-w-lg">
        <CreateProductForm />
      </div>
    </section>
  );
}
