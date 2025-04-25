import { getBrandById } from "@/lib/queries/brands";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import EditableText from "@/components/input/EditableText";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function page({ params }: Props){
  const { id } = await params;
  const brand = await getBrandById(id);

  // si la marca no existe, redirigir a la página de error
  if (!brand) {
    return (
      <section>
        <h1 className="primaryH1">Marca no encontrada</h1>
        <Button asChild className="mt-4">
          <Link href="/brands">Volver a la lista de marcas</Link>
        </Button>
      </section>
    );
  }

  const { name } = brand;

  // Si la marca existe, mostrar la información con breadcrumbs
  return (
    <section>
      <Breadcrumbs 
        customLabels={{
          [`/brands/${id}`]: name || 'Detalle de marca'
        }}
      />
      <h1 className="primaryH1">
        <span className="waving-hand mr-4">👋🏻</span>
        <EditableText 
          height={36}
          value={name} 
          endpoint={`brands/${id}`} 
          fieldName="name" 
          as="span"
          endpointIdParam="id"
        />
      </h1>
    </section>
  );
}