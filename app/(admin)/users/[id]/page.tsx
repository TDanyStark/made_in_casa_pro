/* eslint-disable @next/next/no-img-element */
import EditableText from "@/components/input/EditableText";
import ItemInfoEdit from "@/components/items/ItemInfoEdit";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ColaboradorType, UserRole } from "@/lib/definitions";
import { getUserById } from "@/lib/queries/users";
import Link from "next/link";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import CheckboxChangeState from "@/components/checkbox/CheckboxChangeState";
import { formatDate } from "@/lib/utils";
import DetailsCollaborator from "@/components/users/DetailsCollaborator";
import ChangePassword from "@/components/users/ChangePassword";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function UserPage({ params }: Props) {
  const { id } = await params;
  // Obtener la información del usuario usando el id getUserById
  const userResult = await getUserById(Number(id));

  // Si el usuario no existe, redirigir a la página de error
  if (!userResult) {
    return (
      <section>
        <h1 className="primaryH1">Usuario no encontrado</h1>
        <Button asChild className="mt-4">
          <Link href="/users">Volver a la lista de usuarios</Link>
        </Button>
      </section>
    );
  }

  const user = userResult as ColaboradorType;
  const {
    name,
    email,
    is_active = false,
    rol_id,
    created_at,
    last_login,
    is_internal,
    area_id,
    skills,
    monthly_salary
  } = user;

  return (
    <section>
      <Breadcrumbs
        customLabels={{
          [`/users`]: "Usuarios",
          [`/users/${id}`]: name || "Detalle de usuario",
        }}
      />
      <h1 className="primaryH1">
        <span className="waving-hand mr-4">👋🏻</span>
        <EditableText
          height={36}
          value={name}
          endpoint={`users/${id}`}
          fieldName="name"
          as="h1"
          endpointIdParam="id"
        />
      </h1>
      <div className="mt-4">
        <CheckboxChangeState
          label="Usuario activo"
          id="user-active"
          initialChecked={is_active}
          endpoint={`users/${id}`}
          fieldName="is_active"
        />
      </div>
      <div className="mt-6 flex flex-wrap gap-4">
        <Card className="w-fit p-4 shadow-md rounded-lg">
          <CardHeader className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold">Información</h2>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div>
              <img
                src={`/images/users/users.webp`}
                alt="Fondo gradiente"
                className="h-full w-52 rounded opacity-70"
              />
            </div>
            <div className="flex flex-col gap-4">
              <ItemInfoEdit
                key_update="email"
                endpoint={`users/${id}`}
                label="Correo electrónico"
                value={email}
              />
              <div className="mt-2">
                <ChangePassword userId={id} />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Fecha de creación
                </p>
                <p className="font-medium">{formatDate(created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Último inicio de sesión
                </p>
                <p className="font-medium">{formatDate(last_login)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {rol_id === UserRole.COLABORADOR && (
          <Card className="w-fit p-4 shadow-md rounded-lg">
            <CardHeader className="flex flex-col gap-2">
              <h2 className="text-2xl font-bold">Información adicional colaborador</h2>
            </CardHeader>
            <CardContent className="flex gap-4">
              <DetailsCollaborator
                user_id={Number(id)}
                is_internal={is_internal}
                area_id={Number(area_id)}
                skills={skills}
                monthly_salary={monthly_salary}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
