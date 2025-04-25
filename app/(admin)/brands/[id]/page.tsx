import { getBrandById } from "@/lib/queries/brands";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
        <Button asChild>
          <Link href="/brands">Volver a la lista de marcas</Link>
        </Button>
      </section>
    );
  }
}