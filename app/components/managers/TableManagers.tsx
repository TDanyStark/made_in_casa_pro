"use client";

import { useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ManagerType } from "@/lib/definitions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { useClientsDirectory } from "@/hooks/useClientsDirectory";

interface TableManagersProps {
  managers: ManagerType[];
  pageCount: number;
}

const TableManagers = ({ managers, pageCount }: TableManagersProps) => {
  // En `/managers` la lista es global, así que sin el cliente dos gerentes
  // homónimos son indistinguibles.
  const { clientNames } = useClientsDirectory();

  const columns = useMemo<ColumnDef<ManagerType>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nombre",
        size: 220,
      },
      {
        accessorKey: "email",
        header: "Correo",
        size: 220,
      },
      {
        accessorKey: "client_id",
        header: "Cliente",
        size: 160,
        cell: ({ row }) => {
          const clientId = row.original.client_id;
          return (
            <span>
              {(clientId && clientNames[clientId]) ||
                row.original.client_info?.name ||
                "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "phone",
        header: "Teléfono",
        size: 160,
      },
    ],
    [clientNames]
  );

  // Initialize the table
  const table = useReactTable({
    data: managers,
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
                    <Link
                      href={`/managers/${row.original.id}`}
                      className="block w-full h-full cursor-pointer p-2"
                      >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </Link>
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

export default TableManagers;
