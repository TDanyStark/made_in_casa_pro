/* eslint-disable @next/next/no-img-element */
import { getBrandById } from "@/lib/queries/brands";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import EditableText from "@/components/input/EditableText";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import ItemManager from "@/components/brands/ItemManager";
import ChangeManager from "@/components/brands/ChangeManager";
import BrandManagerHistory from "@/components/brands/BrandManagerHistory";
import { BusinessUnitBrandSelect } from "@/components/brands/BusinessUnitBrandSelect";
import ItemInfo from "@/components/managers/ItemInfo";
import { BriefcaseBusiness } from "lucide-react";
import { API_FLAG_URL, IMG_FLAG_EXT } from "@/config/constants";

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

  const { name, manager, business_unit_id } = brand;
  const name_manager = manager?.name || "Nombre no disponible";
  const id_manager = manager?.id || 0;
  const clientId = manager?.client_id || 0;
  const accept_business_units =
    manager?.client_info?.accept_business_units || false;

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
      <div className="flex flex-col lg:flex-row lg:items-start lg:flex-wrap gap-4 mt-4">
        <Card className="w-fit p-4 shadow-md rounded-lg mb-4">
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
              <ItemManager
                name={name_manager}
                link={`/managers/${id_manager}`}
              />
              <ItemInfo
                icon={BriefcaseBusiness}
                href={`/clients/${manager?.client_info?.id}`}
                label="Cliente"
                value={
                  <div className="flex items-center gap-2">
                    {manager?.client_info?.name || "Sin cliente"}
                    <img
                      className="inline-block h-auto w-4"
                      src={`${API_FLAG_URL}${manager?.client_info?.country?.flag}${IMG_FLAG_EXT}`}
                      alt={manager?.client_info?.name || "Client image"}
                    />
                  </div>
                }
              />
              <ChangeManager
                brandId={Number(id)}
                managerId={id_manager}
                clientId={clientId || 0}
              />

              {accept_business_units && (
                <div className="mt-4 w-[388px] max-w-full">
                  <BusinessUnitBrandSelect
                    standalone
                    brandId={id}
                    value={business_unit_id || undefined}
                    label="Unidad de Negocio"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <BrandManagerHistory brandId={id} />
      </div>
    </section>
  );
}
