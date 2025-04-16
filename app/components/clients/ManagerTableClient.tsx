'use client';

import { useSearchParams } from 'next/navigation';
import { useManagersQuery } from '@/hooks/useManagersQuery';
import ListManager from './ListManager';

interface ManagerTableClientProps {
  clientId?: string;
  endpoint?: string; // Nuevo parámetro para especificar el endpoint
}

export default function ManagerTableClient({ clientId, endpoint = "managers" }: ManagerTableClientProps) {
  const searchParams = useSearchParams();
  const search = searchParams.get('search') || '';
  const page = searchParams.get('page') || '1';
  
  // Utilizar React Query para obtener los managers
  const { data, isLoading, isError } = useManagersQuery({
    clientId,
    page,
    search,
    endpoint, // Ahora podemos pasar el endpoint dinámicamente
  });

  // Valores predeterminados si hay error o está cargando
  const managers = data?.managers || [];
  const pageCount = data?.pageCount || 1;
  const currentPage = data?.currentPage || 1;

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="text-center py-4">Cargando...</div>
      ) : isError ? (
        <div className="text-center py-4 text-red-500">Error al cargar los {endpoint}</div>
      ) : (
        <>
          <ListManager
            clientId={clientId}
            managers={managers}
            pageCount={pageCount}
            currentPage={currentPage}
            searchQuery={search}
          />
        </>
      )}
    </div>
  );
}