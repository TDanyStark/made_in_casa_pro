"use client";

import { useQuery } from "@tanstack/react-query";
import { UserType } from "@/lib/definitions";

interface RoleType {
  id: number;
  role: string;
}

export default function TableUsers() {
  const { data: users, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Error al cargar usuarios");
      }
      return response.json();
    },
  });

  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const response = await fetch("/api/roles");
      if (!response.ok) {
        throw new Error("Error al cargar roles");
      }
      return response.json() as Promise<RoleType[]>;
    },
  });

  // Función para obtener el nombre del rol según su id
  const getRoleName = (roleId: number) => {
    if (!roles) return "Cargando...";
    const role = roles.find((r: RoleType) => r.id === roleId);
    return role ? role.role : `Rol ${roleId}`;
  };

  if (usersLoading || rolesLoading) return <p>Cargando usuarios...</p>;
  if (usersError) return <p>Error al cargar usuarios: {(usersError as Error).message}</p>;

  return (
    <div className="rounded-md border">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nombre
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Email
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rol
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users && users.map((user: UserType) => (
            <tr key={user.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {user.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {user.email}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {getRoleName(user.rol_id)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button className="text-indigo-600 hover:text-indigo-900 mr-2">
                  Editar
                </button>
                <button className="text-red-600 hover:text-red-900">
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
