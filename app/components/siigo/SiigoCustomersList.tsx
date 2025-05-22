"use client";

import { useState, useEffect } from 'react';
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


export default function SiigoCustomersList() {
  const [customers, setCustomers] = useState<SiigoCustomerType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  async function fetchCustomers(pageNum = 1, term = '') {
    setIsLoading(true);
    try {
      let url = `/api/siigo/customers?page=${pageNum}&pageSize=10`;
      if (term) {
        url += `&term=${encodeURIComponent(term)}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Error al cargar clientes');
      
      const data = await response.json();
      setCustomers(data.results || []);
      setTotalPages(Math.ceil(data.pagination.total_results / data.pagination.page_size));
      setTotalResults(data.pagination.total_results);
    } catch (error) {
      console.error('Error al cargar clientes de Siigo:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomers(page, searchTerm);
  }, [page, searchTerm]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers(1, searchTerm);
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
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
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
