"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ManagerType } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Pagination from "@/components/pagination/Pagination";
import SearchBar from "@/components/search/search";
import TableManagers from "./TableManagers";

interface Props {
  clientId?: string;
  managers: ManagerType[];
  pageCount: number;
  currentPage: number;
  searchQuery?: string;
}

const ListManager = ({ clientId, managers, pageCount, currentPage, searchQuery = "" }: Props) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replace } = useRouter();
  
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
    replace(`${pathname}?${createQueryString({ page: page, search: searchQuery || null })}`);
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
        <TableManagers managers={managers} pageCount={pageCount} />
        
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