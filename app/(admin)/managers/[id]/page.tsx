/* eslint-disable @next/next/no-img-element */
import ItemBrands from "@/components/managers/ItemBrands";
import ItemInfo from "@/components/managers/ItemInfo";
import EditableText from "@/components/input/EditableText";
import BiographyEditor from "@/components/managers/BiographyEditor";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ManagerType } from "@/lib/definitions";
import { getBrandsByManagerId } from "@/lib/queries/brands";
import { getManagerById } from "@/lib/queries/managers";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ManagerPage({ params }: Props) {
  const { id } = await params;
  // obtener la  información del gerente usando el id getManagerById
  const manager = await getManagerById(id);
  const { name, email, phone, biography } = manager as ManagerType;

  const brandsData = await getBrandsByManagerId(id);
  // Serializa las marcas para asegurarse de que solo se pasan objetos planos al componente cliente
  const brands = brandsData.map(brand => ({
    id: brand.id,
    name: brand.name,
    manager_id: brand.manager_id
  }));
  
  return (
    <section>
      <h1 className="primaryH1">
        <span className="waving-hand mr-4">👋🏻</span>
        <EditableText 
          height={36}
          value={name} 
          endpoint={`managers/${id}`} 
          fieldName="name" 
          as="span"
          endpointIdParam="id"
        />
      </h1>
      <div className="mt-6">
        <Card className="w-fit p-4 shadow-md rounded-lg">
          <CardHeader className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold">Información</h2>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div>
              <img
                src={`/images/managers/manager_img.webp`}
                alt="Fondo gradiente"
                className="h-full w-52 rounded opacity-70"
              />
            </div>
            <div className="flex flex-col gap-4">
              <ItemInfo
                key_update="email"
                label="Correo electrónico"
                value={email}
              />
              <ItemInfo 
                key_update="phone" 
                label="Teléfono" 
                value={phone} 
              />
              <ItemBrands brands={brands} />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <BiographyEditor initialContent={biography || ""} />
      </div>
    </section>
  );
}
