'use client';

import { useSearchParams } from 'next/navigation';
import { useManagersQuery } from '@/hooks/useManagersQuery';
import ListManager from './ListManager';

interface ManagerTableClientProps {
  clientId?: string;
}

export default function ManagerTableClient({ clientId }: ManagerTableClientProps) {
  console.log('Render ManagerTableClient');
  const searchParams = useSearchParams();
  const search = searchParams.get('search') || '';
  const page = searchParams.get('page') || '1';
  
  // Utilizar React Query para obtener los managers
  const { data, isLoading, isError } = useManagersQuery({
    clientId,
    page,
    search,
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
        <div className="text-center py-4 text-red-500">Error al cargar los managers</div>
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