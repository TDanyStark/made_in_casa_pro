/* eslint-disable @next/next/no-img-element */
import { getBrandById } from "@/lib/queries/brands";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import EditableText from "@/components/input/EditableText";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import ItemManager from "@/components/brands/ItemManager";
import ChangeManager from "@/components/brands/ChangeManager";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function page({ params }: Props) {
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

  const { name, manager } = brand;
  const name_manager = manager?.name || "Nombre no disponible";
  const id_manager = manager?.id || "ID no disponible";

  // Si la marca existe, mostrar la información con breadcrumbs
  return (
    <section>
      <Breadcrumbs
        customLabels={{
          [`/brands/${id}`]: name || "Detalle de marca",
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
      <div className="flex flex-col lg:flex-row gap-4 mt-4">
        <Card className="p-4 shadow-md rounded-lg">
          <CardHeader className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold">Información de la Marca</h2>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div>
              <img
                src={`/images/brands/brand_img.webp`}
                alt="Fondo gradiente"
                className="h-full w-52 rounded opacity-70"
              />
            </div>
            <div className="flex flex-col gap-4">
              <ItemManager name={name_manager} link={`/managers/${id_manager}`} />
              <ChangeManager brand={brand} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <p>Historial.</p>
        </Card>
      </div>
    </section>
  );
}
