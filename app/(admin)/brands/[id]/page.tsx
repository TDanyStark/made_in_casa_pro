import { getBrandById } from "@/lib/queries/brands";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";

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

  // Si la marca existe, mostrar la información con breadcrumbs
  return (
    <div>
      <Breadcrumbs 
        customLabels={{
          [`/brands/${id}`]: brand.name || 'Detalle de marca'
        }}
      />
      
      <section>
        <h1 className="primaryH1">{brand.name}</h1>
        {/* Resto de la información de la marca */}
      </section>
    </div>
  );
}