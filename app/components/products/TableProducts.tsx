"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ProductType } from "@/lib/definitions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface TableProductsProps {
  products: ProductType[];
  pageCount: number;
}

const columns: ColumnDef<ProductType>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <div className="text-center">{row.getValue("id")}</div>,
    size: 50,
  },
  {
    accessorKey: "name",
    header: "Nombre",
    size: 220,
  },
  {
    accessorKey: "category_name",
    header: "Categoría",
    size: 160,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.getValue("category_name") || "Sin categoría"}
      </span>
    ),
  },
  {
    accessorKey: "is_active",
    header: "Estado",
    size: 100,
    cell: ({ row }) => {
      const active = Boolean(row.getValue("is_active"));
      return (
        <Badge variant={active ? "default" : "secondary"}>
          {active ? "Activo" : "Inactivo"}
        </Badge>
      );
    },
  },
];

const TableProducts = ({ products, pageCount }: TableProductsProps) => {
  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  });

  return (
    <div className="rounded-md border min-h-[404px]">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
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
                    : flexRender(header.column.columnDef.header, header.getContext())}
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
                className="hover:bg-muted transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="p-0">
                    <Link
                      href={`/products/${row.getValue("id")}`}
                      className="block w-full h-full cursor-pointer p-2"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Link>
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No se encontraron productos
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default TableProducts;
