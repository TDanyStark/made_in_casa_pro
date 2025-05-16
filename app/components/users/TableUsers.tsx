"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { UserRole, UserType } from "@/lib/definitions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch } from "@/lib/services/apiService";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import { useState } from "react";

interface RoleType {
  id: number;
  role: string;
}

interface TableUsersProps {
  users: UserType[] | never[];
  pageCount?: number;
}

const TableUsers = ({ users = [], pageCount = 1 }: TableUsersProps) => {
  // Estado para controlar los IDs de usuarios que están siendo actualizados
  const [loadingUsers, setLoadingUsers] = useState<number[]>([]);

  const queryClient = useQueryClient();
  
  // Consulta para obtener roles
  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const response = await get("/roles");
      if (!response.ok) {
        throw new Error("Error al cargar roles");
      }
      return response.data as RoleType[];
    },
  });
  const changeIsActive = async (userId: number, isActive: boolean) => {
    try {
      // Añadir el ID del usuario al array de usuarios en carga
      setLoadingUsers((prev) => [...prev, userId]);
      
      const response = await patch(`users/${userId}`, {
        is_active: !isActive,
      });
      
      if (!response.ok) {
        throw new Error("Error al cambiar el estado del usuario");
      }

      // invalidar todas las querys que empiecen con users
      await queryClient.invalidateQueries({ queryKey: ["users"] })
      
      toast.success(
        `El estado del usuario ${userId} ha sido cambiado a ${
          !isActive ? "activo" : "inactivo"
        }`,
        {
          duration: 3000,
        }
      );
    } catch (error) {
      toast.error("Error al cambiar el estado del usuario");
      console.error(error);
    } finally {
      // Quitar el ID del usuario del array de usuarios en carga
      setLoadingUsers((prev) => prev.filter((id) => id !== userId));
    }
  };

  // Función para obtener el nombre del rol según su id
  const getRoleName = (roleId: number) => {
    if (!roles) return "Cargando...";
    const role = roles.find((r: RoleType) => r.id === roleId);
    return role ? role.role : `Rol ${roleId}`;
  };
  // Función para obtener la clase del badge según el rol
  const getClassForBadge = (roleId: number): string => {
    switch (roleId) {
      case UserRole.COMERCIAL:
        return "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200";
      case UserRole.DIRECTIVO:
        return "bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200";
      case UserRole.COLABORADOR:
        return "bg-green-100 text-green-800 hover:bg-green-200 border-green-200";
      case UserRole.ADMIN:
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200";
      case UserRole.NO_AUTHENTICADO:
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-200";
    }
  }; // Define columns for the users table
  const columns: ColumnDef<UserType>[] = [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => (
        <div className="text-center">{row.getValue("id")}</div>
      ),
      size: 40,
    },
    {
      accessorKey: "name",
      header: "Nombre",
      cell: ({ row }) => (
        <div className="text-nowrap">{row.getValue("name")}</div>
      ),
      size: 200,
    },
    {
      accessorKey: "email",
      header: "Correo",
      cell: ({ row }) => (
        <div className="text-nowrap">{row.getValue("email")}</div>
      ),
      size: 200,
    },
    {
      accessorKey: "rol_id",
      header: "Rol",
      cell: ({ row }) => {
        return (
          <div className="text-nowrap">
            <Badge
              className={`${getClassForBadge(
                row.getValue("rol_id")
              )} font-medium rounded-md px-2.5 py-0.5 transition-colors`}
            >
              {getRoleName(row.getValue("rol_id"))}
            </Badge>
          </div>
        );
      },
      size: 150,
    },
    {      id: "is_active",
      accessorKey: "is_active",
      header: "Estado",
      cell: ({ row }) => {
        const userId = row.getValue("id") as number;
        const isLoading = loadingUsers.includes(userId);
        const isActive = Boolean(row.getValue("is_active"));
        
        return (
          <div className="flex space-x-2 justify-center pr-2">
            {isActive === true ? (
              <Button
                className="bg-market-pink text-white hover:bg-market-pink/80"
                size="icon"
                onClick={() => changeIsActive(userId, true)}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye />}
              </Button>
            ) : (
              <Button
                className="bg-muted-foreground"
                size="icon"
                onClick={() => changeIsActive(userId, false)}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff />}
              </Button>
            )}
          </div>
        );
      },
      size: 80,
    },
  ];

  // Initialize the table
  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  });

  return (
    <div className="rounded-md border h-[572.4px]">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="grid-row">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{
                    maxWidth: header.getSize() + "px",
                    width: header.getSize() + "px",
                    minWidth: header.getSize() + "px",
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="grid-row hover:bg-muted transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="p-0">
                    {cell.column.id !== "is_active" ? (
                      <Link
                        href={`/users/${row.getValue("id")}`}
                        className="block w-full h-full cursor-pointer p-2"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </Link>
                    ) : (
                      <div className="p-2">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </div>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No se encontraron resultados
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default TableUsers;
