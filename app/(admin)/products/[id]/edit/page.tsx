import { getProductById } from "@/lib/queries/products";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import EditProductForm from "@/components/products/EditProductForm";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const product = await getProductById(Number(id));

  if (!product) {
    return (
      <section>
        <h1 className="primaryH1">Producto no encontrado</h1>
        <Button asChild className="mt-4">
          <Link href="/products">Volver a productos</Link>
        </Button>
      </section>
    );
  }

  return (
    <section>
      <Breadcrumbs
        customLabels={{
          [`/products/${id}`]: product.name,
          [`/products/${id}/edit`]: "Editar",
        }}
      />
      <h1 className="primaryH1">Editar producto</h1>
      <div className="mt-6 max-w-lg">
        <EditProductForm product={product} />
      </div>
    </section>
  );
}
