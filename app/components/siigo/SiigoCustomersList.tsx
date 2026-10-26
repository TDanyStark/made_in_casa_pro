"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/services/apiService';
import { SiigoCustomerType } from '@/lib/services/siigo/SiigoDefinitions';
import { Loader2, Search, ChevronLeft, ChevronRight, Phone, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 10;

interface SiigoCustomersResponse {
  results?: SiigoCustomerType[];
  pagination?: { total_results: number; page_size: number };
}

export default function SiigoCustomersList() {
  // `inputValue` es lo que se escribe; `searchTerm` solo cambia al enviar el formulario.
  const [inputValue, setInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['siigo-customers', page, searchTerm],
    queryFn: async () => {
      let url = `siigo/customers?page=${page}&pageSize=${PAGE_SIZE}`;
      if (searchTerm) url += `&term=${encodeURIComponent(searchTerm)}`;
      const res = await get<SiigoCustomersResponse>(url);
      if (!res.ok) throw new Error(res.error);
      return res.data as SiigoCustomersResponse;
    },
  });

  const customers = data?.results ?? [];
  const totalResults = data?.pagination?.total_results ?? customers.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / (data?.pagination?.page_size || PAGE_SIZE)));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearchTerm(inputValue.trim());
  };

  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Clientes Siigo</h3>
        <div className="text-sm text-gray-500">
          Total: {totalResults} clientes
        </div>
      </div>
      
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Buscar por nombre o identificación..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-xs"
        />
        <Button type="submit" size="sm" variant="secondary">
          <Search size={16} className="mr-2" />
          Buscar
        </Button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : isError ? (
        <div className="text-center py-8 text-destructive">
          Error al cargar los clientes de Siigo
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No se encontraron clientes
        </div>
      ) : (
        <>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Identificación</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{customer.name.join(' ')}</div>
                        {customer.commercial_name && (
                          <div className="text-sm text-gray-500">
                            {customer.commercial_name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{customer.id_type.name}</span>
                        <span className="text-sm font-medium">{customer.identification}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.contacts && customer.contacts.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center text-sm">
                            <Mail size={14} className="mr-1" />
                            <span>{customer.contacts[0].email}</span>
                          </div>
                          {customer.contacts[0].phone && (
                            <div className="flex items-center text-sm">
                              <Phone size={14} className="mr-1" />
                              <span>{customer.contacts[0].phone.number}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={customer.active ? "default" : "outline"}
                      >
                        {customer.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-center space-x-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <div className="text-sm">
              Página {page} de {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={page >= totalPages}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
