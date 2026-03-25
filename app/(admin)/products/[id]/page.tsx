import { getProductById } from "@/lib/queries/products";
import { getTaskTemplatesByProductId } from "@/lib/queries/productTaskTemplates";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import EditableText from "@/components/input/EditableText";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ProductTasksManager from "@/components/products/ProductTasksManager";
import EditProductModal from "@/components/products/EditProductModal";
import { formatDate } from "@/lib/utils";
import { Tag, CalendarDays } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProductPage({ params }: Props) {
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

  const taskTemplates = await getTaskTemplatesByProductId(Number(id));
  const { name, category_name, description, is_active, created_at } = product;

  return (
    <section>
      <Breadcrumbs
        customLabels={{ [`/products/${id}`]: name }}
      />
      <h1 className="primaryH1">
        <EditableText
          height={36}
          value={name}
          endpoint={`products/${id}`}
          fieldName="name"
          as="span"
          endpointIdParam="id"
        />
      </h1>

      <div className="flex flex-col lg:flex-row lg:items-start lg:flex-wrap gap-4 mt-4">
        {/* Info card */}
        <Card className="w-fit p-4 shadow-md rounded-lg">
          <CardHeader>
            <h2 className="text-2xl font-semibold">Información del producto</h2>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 min-w-[260px]">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Categoría</span>
              <span className="font-medium text-sm">
                {category_name ?? "Sin categoría"}
              </span>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Estado</p>
              <Badge variant={is_active ? "default" : "secondary"}>
                {is_active ? "Activo" : "Inactivo"}
              </Badge>
            </div>

            {description && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Descripción</p>
                <p className="text-sm">{description}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Creado</span>
              <span className="text-sm">{formatDate(created_at)}</span>
            </div>

            <EditProductModal product={product} />
          </CardContent>
        </Card>

        {/* Tasks card */}
        <Card className="flex-1 min-w-[340px] p-4 shadow-md rounded-lg">
          <CardHeader>
            <h2 className="text-2xl font-semibold">
              Flujo de trabajo predefinido
            </h2>
            <p className="text-sm text-muted-foreground">
              Estas tareas se activarán al crear un proyecto con este producto. Arrástralas para definir el orden de ejecución.
            </p>
          </CardHeader>
          <CardContent>
            <ProductTasksManager
              productId={Number(id)}
              initialTasks={taskTemplates}
            />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
