import { links, linksNotVisible } from "./LinksData";
import { UserRole } from "./definitions";

// 🔹 Generar un mapa de rutas con sus roles permitidos a partir de `links` y `linksNotVisible`
export const routePermissions: Record<string, UserRole[]> = [...links, ...linksNotVisible].reduce((acc, link) => {
  acc['href' in link ? link.href : link.route] = link.roles;
  return acc;
}, {} as Record<string, UserRole[]>);

// 🔹 Definir la única ruta pública
export const publicRoute = "/";
