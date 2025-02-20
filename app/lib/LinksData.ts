import { House, Folder, LayoutList, BookUser, LibraryBig, Users } from 'lucide-react';


export const links = [
  { 
    name: 'Inicio', 
    href: '/dashboard', 
    icon: House,
    roles: ["admin", "comercial", "directivo", "colaborador"]
  },
  {
    name: 'Proyectos',
    href: '/dashboard/projects',
    icon: Folder,
    roles: ["admin", "comercial", "directivo"]
  },
  { 
    name: 'Tareas', 
    href: '/dashboard/tasks', 
    icon: LayoutList,
    roles: ["admin", "comercial", "directivo", "colaborador"]
  },
  { 
    name: 'Clientes', 
    href: '/dashboard/clients', 
    icon: BookUser,
    roles: ["admin", "comercial", "directivo"]
  },
  { 
    name: 'Productos', 
    href: '/dashboard/products', 
    icon: LibraryBig,
    roles: ["admin", "comercial", "directivo"]
  },
  { 
    name: 'Usuarios', 
    href: '/dashboard/users', 
    icon: Users,
    roles: ["admin", "directivo"]
  },
];
