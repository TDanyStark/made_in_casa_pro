/* eslint-disable @next/next/no-img-element */
import ItemBrands from "@/components/managers/ItemBrands";
import ItemInfo from "@/components/managers/ItemInfo";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ManagerType } from "@/lib/definitions";
import { getManagerById } from "@/lib/queries/managers";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ManagerPage({ params }: Props) {
  const { id } = await params;
  // obtener la  información del gerente usando el id getManagerById
  const manager = await getManagerById(id);
  const { name, email, phone, biography } = manager as ManagerType;

  return (
    <section>
      <h1 className="primaryH1">{name} 👋🏻</h1>
      <div className="mt-6">
        <Card className="w-full max-w-2xl p-4 shadow-md rounded-lg">
          <CardHeader className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold">Información de contacto</h2>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div>
              <img
                src={`/images/managers/manager_img.webp`}
                alt="Fondo gradiente"
                className="h-full rounded"
              />
            </div>
            <div className="flex flex-col gap-4">
              <ItemInfo
                iconKey="mail"
                label="Correo electrónico"
                value={email}
              />
              <ItemInfo iconKey="phone" label="Teléfono" value={phone} />
              <ItemBrands />
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
