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

interface BreadcrumbsProps {
  homeElement?: React.ReactNode;
  separator?: React.ReactNode;
  containerClasses?: string;
  listClasses?: string;
  activeItemClasses?: string;
  inactiveItemClasses?: string;
  customLabels?: Record<string, string>;
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