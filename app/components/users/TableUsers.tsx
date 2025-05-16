"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { UserType } from "@/lib/definitions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";

interface RoleType {
  id: number;
  role: string;
}

interface TableUsersProps {
  users: UserType[] | never[];
  pageCount?: number;
}

const TableUsers = ({ users = [], pageCount = 1 }: TableUsersProps) => {
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

  // Función para obtener el nombre del rol según su id
  const getRoleName = (roleId: number) => {
    if (!roles) return "Cargando...";
    const role = roles.find((r: RoleType) => r.id === roleId);
    return role ? role.role : `Rol ${roleId}`;
  };
    // Define columns for the users table
  const columns: ColumnDef<UserType>[] = [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => <div className="text-center">{row.getValue("id")}</div>,
      size: 40,
    },    {
      accessorKey: "name",
      header: "Nombre",
      cell: ({ row }) => <div>{row.getValue("name")}</div>,
      size: 200,
    },
    {
      accessorKey: "email",
      header: "Correo",
      cell: ({ row }) => <div>{row.getValue("email")}</div>,
      size: 200,
    },
    {
      accessorKey: "rol_id",
      header: "Rol",
      cell: ({ row }) => {
        return getRoleName(row.getValue("rol_id"));
      },
      size: 150,
    },
    {      id: "actions",
      header: "Acciones",
      cell: () => {
        return (
          <div className="flex space-x-2 justify-end pr-2">
            <button className="text-indigo-600 hover:text-indigo-900">
              Editar
            </button>
            <button className="text-red-600 hover:text-red-900">
              Eliminar
            </button>
          </div>
        );
      },
      size: 150,
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
    <div className="rounded-md border h-[404px]">
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
                    {cell.column.id !== "actions" ? (
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
