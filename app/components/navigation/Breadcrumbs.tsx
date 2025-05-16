'use client';

import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

// Define la estructura para rutas manuales
interface BreadcrumbItem {
  href: string;
  label: string;
}

/**
 * Componente de navegación Breadcrumbs que muestra la ruta de navegación actual.
 * 
 * @component
 * @example
 * // Uso básico (generación automática de migas de pan desde la URL)
 * <Breadcrumbs />
 * 
 * @example
 * // Personalización de clases y estilos
 * <Breadcrumbs 
 *   containerClasses="flex py-5 bg-gray-100"
 *   activeItemClasses="text-blue-600 font-bold"
 *   inactiveItemClasses="text-gray-500 hover:text-blue-500"
 * />
 * 
 * @example
 * // Usando etiquetas personalizadas para rutas específicas
 * <Breadcrumbs 
 *   customLabels={{
 *     "/brands": "Marcas", 
 *     "/clients": "Clientes",
 *     "/clients/[id]": "Detalles del Cliente"
 *   }}
 * />
 * 
 * @example
 * // Usando migas de pan manuales en lugar de generación automática
 * <Breadcrumbs 
 *   manualBreadcrumbs={[
 *     { href: "/dashboard", label: "Panel" },
 *     { href: "/dashboard/reports", label: "Reportes" },
 *     { href: "/dashboard/reports/annual", label: "Reporte Anual" }
 *   ]}
 * />
 * 
 * @example
 * // Cambiando el ícono de inicio y el separador
 * import { ChevronDoubleRight, House } from 'lucide-react';
 * <Breadcrumbs 
 *   homeElement={<House size={18} />}
 *   separator={<ChevronDoubleRight size={12} />}
 * />
 */
interface BreadcrumbsProps {
  /** Elemento a mostrar como ícono de inicio (home). Por defecto es el ícono Home. */
  homeElement?: React.ReactNode;
  /** Elemento separador entre las migas de pan. Por defecto es el ícono ChevronRight. */
  separator?: React.ReactNode;
  /** Clases CSS para el contenedor principal de navegación. */
  containerClasses?: string;
  /** Clases CSS para la lista de migas de pan. */
  listClasses?: string;
  /** Clases CSS para el elemento activo (actual) en la navegación. */
  activeItemClasses?: string;
  /** Clases CSS para los elementos inactivos de la navegación. */
  inactiveItemClasses?: string;
  /** Etiquetas personalizadas para rutas específicas. Clave es la ruta (ej. "/brands"), valor es la etiqueta. */
  customLabels?: Record<string, string>;
  /** Migas de pan definidas manualmente. Si se proporcionan, se usan en lugar de generar automáticamente desde la URL. */
  manualBreadcrumbs?: BreadcrumbItem[];
}

export function Breadcrumbs({
  homeElement = <Home size={16} />,
  separator = <ChevronRight size={16} />,
  containerClasses = "flex py-3 px-4 mb-4",
  listClasses = "flex items-center space-x-2",
  activeItemClasses = "text-foreground font-medium",
  inactiveItemClasses = "text-muted-foreground hover:text-primary",
  customLabels = {},
  manualBreadcrumbs
}: BreadcrumbsProps) {
  const pathname = usePathname();
  
  const breadcrumbs = useMemo(() => {
    // Si hay rutas manuales definidas, usar esas
    if (manualBreadcrumbs && manualBreadcrumbs.length > 0) {
      return manualBreadcrumbs.map((item, index) => ({
        ...item,
        isCurrent: index === manualBreadcrumbs.length - 1 // El último elemento es el activo
      }));
    }
    
    // Si no hay rutas manuales, generar desde la URL como antes
    // Remove query parameters
    const cleanPath = pathname?.split('?')[0];
    if (!cleanPath) return [];

    // Skip the /admin/ part if present (for your admin routes)
    const pathWithoutAdmin = cleanPath.startsWith('/(admin)') 
      ? cleanPath.replace('/(admin)', '') 
      : cleanPath;

    // Split and remove empty items
    const segments = pathWithoutAdmin
      .split('/')
      .filter(segment => segment);
    
    // Map segments to breadcrumb items
    return segments.map((segment) => {
      // Check if segment is dynamic (e.g., [id])
      const isDynamicSegment = /^\[.*\]$/.test(segment);
      
      // Create the href cumulatively for each breadcrumb
      const href = '/' + segments.slice(0, segments.indexOf(segment) + 1).join('/');
      
      // Get the label for this segment
      let label;
      if (isDynamicSegment) {
        // For dynamic segments, try to use a custom label or default to the segment without brackets
        label = customLabels[href] || segment.replace(/[\[\]]/g, '');
      } else {
        // For static segments, try to use a custom label or capitalize the segment
        label = customLabels[href] || segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
      }
      
      // Create breadcrumb item
      return {
        href,
        label,
        isCurrent: segments.indexOf(segment) === segments.length - 1
      };
    });
  }, [pathname, customLabels, manualBreadcrumbs]);

  // If no breadcrumbs, don't render anything
  if (breadcrumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={containerClasses}>
      <ol className={listClasses}>
        <li>
          <Link href="/" className={inactiveItemClasses}>
            {homeElement}
          </Link>
        </li>
        
        {breadcrumbs.map((breadcrumb) => (
          <li key={breadcrumb.href} className="flex items-center">
            {/* Siempre mostrar el separador antes de cada elemento */}
            <span className="mx-2 text-muted-foreground" aria-hidden="true">
              {separator}
            </span>
            
            {breadcrumb.isCurrent ? (
              <span className={activeItemClasses} aria-current="page">
                {breadcrumb.label}
              </span>
            ) : (
              <Link href={breadcrumb.href} className={inactiveItemClasses}>
                {breadcrumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}