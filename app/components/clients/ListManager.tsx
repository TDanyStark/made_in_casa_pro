"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Pagination from "@/components/pagination/Pagination";
import SearchBar from "@/components/search/search";

interface Props {
  clientId?: string;
  managers: ManagerType[];
  pageCount: number;
  currentPage: number;
  searchQuery?: string;
}

// Define columns for the managers table
const columns: ColumnDef<ManagerType>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <div className="text-center">{row.getValue("id")}</div>,
  },
  {
    accessorKey: "name",
    header: "Nombre",
  },
  {
    accessorKey: "email",
    header: "Correo",
  },
  {
    accessorKey: "phone",
    header: "Teléfono",
  },
];

const ListManager = ({ clientId, managers, pageCount, currentPage, searchQuery = "" }: Props) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replace } = useRouter();
  
  // Initialize the table
  const table = useReactTable({
    data: managers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  });

  // Function to create a new URLSearchParams with updated parameters
  const createQueryString = (params: Record<string, string | number | null>) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());
    
    // Update search params based on provided params
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) {
        newSearchParams.delete(key);
      } else {
        newSearchParams.set(key, String(value));
      }
    });
    
    return newSearchParams.toString();
  };
  
  // Handle pagination
  const handlePageChange = (page: number) => {
    replace(`${pathname}?${createQueryString({ page: page + 1, search: searchQuery || null })}`);
  };
  
  // Handle search
  const handleSearch = (searchValue: string) => {
    replace(`${pathname}?${createQueryString({ page: 1, search: searchValue })}`);
  };

  // Handle reset
  const handleReset = () => {
    replace(`${pathname}?${createQueryString({ page: null, search: null })}`);
  };
  
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>
          {clientId ? "Gerentes del Cliente" : "Todos los Gerentes"}
        </CardTitle>
        <SearchBar 
          initialSearchValue={searchQuery}
          placeholder="Buscar gerentes..."
          onSearch={handleSearch}
          onReset={handleReset}
        />
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
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
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No se encontraron resultados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Usar el componente de paginación */}
        <Pagination 
          currentPage={currentPage} 
          pageCount={pageCount} 
          onPageChange={handlePageChange} 
        />
      </CardContent>
    </Card>
  );
};

export default ListManager;