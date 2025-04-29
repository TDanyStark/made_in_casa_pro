import { links, linksNotVisible } from "./LinksData";
import { UserRole } from "./definitions";

// 🔹 Generar un mapa de rutas con sus roles permitidos a partir de `links` y `linksNotVisible`
export const routePermissions: Record<string, UserRole[]> = [...links, ...linksNotVisible].reduce((acc, link) => {
  acc['href' in link ? link.href : link.route] = link.roles;
  return acc;
}, {} as Record<string, UserRole[]>);

// 🔹 Definir la única ruta pública
export const publicRoute = "/";

// 🔹 Función para verificar permisos de rutas, incluyendo rutas dinámicas
export function checkRoutePermission(
  currentPath: string, 
  userRole: UserRole
): boolean {
  // Verificar si hay una coincidencia exacta
  if (routePermissions[currentPath]?.includes(userRole)) {
    return true;
  }

  // Verificar patrones de ruta dinámica (por ejemplo, clients/[id])
  const pathSegments = currentPath.split('/').filter(Boolean);
  
  // Buscar en todas las rutas con permisos
  for (const route in routePermissions) {
    const routeSegments = route.split('/').filter(Boolean);
    
    // Si tienen diferente número de segmentos, no coinciden
    if (routeSegments.length !== pathSegments.length) {
      continue;
    }
    
    // Verificar si la ruta coincide con el patrón (permitiendo parámetros dinámicos)
    const isMatch = routeSegments.every((segment, index) => {
      // Si el segmento tiene [algo], es un parámetro dinámico y coincide con cualquier valor
      return segment.includes('[') && segment.includes(']') || segment === pathSegments[index];
    });
    
    // Si coincide con el patrón y el usuario tiene el rol requerido, permitir acceso
    if (isMatch && routePermissions[route].includes(userRole)) {
      return true;
    }
  }
  
  // Por defecto, denegar acceso
  return false;
}
