import { links } from "./LinksData";
import { UserRole } from "./definitions";

// 🔹 Generar un mapa de rutas con sus roles permitidos a partir de `links`
export const routePermissions: Record<string, UserRole[]> = links.reduce((acc, link) => {
  acc[link.href] = link.roles;
  return acc;
}, {} as Record<string, UserRole[]>);

// 🔹 Definir la única ruta pública
export const publicRoute = "/";
