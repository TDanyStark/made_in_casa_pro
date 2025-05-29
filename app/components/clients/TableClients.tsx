/* eslint-disable @next/next/no-img-element */
"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ClientType } from "@/lib/definitions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { API_FLAG_URL, IMG_FLAG_EXT } from "@/config/constants";

interface TableClientsProps {
  clients: ClientType[];
  pageCount: number;
}

// Define columns for the clients table
export const columns: ColumnDef<ClientType>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <div className="text-center">{row.getValue("id")}</div>,
    size: 40,
  },
  {
    accessorKey: "name",
    header: "Nombre",
    size: 300,
  },
  {
    accessorKey: "country",
    header: "País",
    cell: ({ row }) => {
      const country = row.getValue("country") as ClientType["country"];
      if (!country) return <div>-</div>;
      
      return (
        <div className="flex items-center gap-2">
          <img
            src={`${API_FLAG_URL}${country.flag}${IMG_FLAG_EXT}`}
            alt={`Bandera de ${country.name}`}
            width="20"
            height="15"
            className="inline-block"
          />
          <span>{country.name}</span>
        </div>
      );
    },
    size: 200,
  },
];

const TableClients = ({ clients, pageCount }: TableClientsProps) => {
  // Initialize the table
  const table = useReactTable({
    data: clients,
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
                      href={`/clients/${row.getValue("id")}`}
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

export default TableClients;
