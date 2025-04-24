/* eslint-disable @next/next/no-img-element */
import ItemBrands from "@/components/managers/ItemBrands";
import ItemInfo from "@/components/managers/ItemInfo";
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
      <h1 className="primaryH1">{name} <span className="waving-hand">👋🏻</span></h1>
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
                className="h-full w-52 rounded"
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
        <h2 className="text-2xl font-bold">Biografía</h2>
        <p>{biography}</p>
      </div>
    </section>
  );
}
