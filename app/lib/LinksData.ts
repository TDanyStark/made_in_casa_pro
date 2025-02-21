import { House, Folder, LayoutList, BookUser, LibraryBig, Users } from 'lucide-react';
import { UserRole } from './definitions';


export const links = [
  { 
    name: 'Inicio', 
    href: '/dashboard', 
    icon: House,
    roles: [UserRole.COMERCIAL, UserRole.DIRECTIVO, UserRole.COLABORADOR, UserRole.ADMIN]
  },
  {
    name: 'Proyectos',
    href: '/dashboard/projects',
    icon: Folder,
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  { 
    name: 'Tareas', 
    href: '/dashboard/tasks', 
    icon: LayoutList,
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  { 
    name: 'Productos', 
    href: '/dashboard/products', 
    icon: LibraryBig,
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  { 
    name: 'Clientes', 
    href: '/dashboard/clients', 
    icon: BookUser,
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  { 
    name: 'Usuarios', 
    href: '/dashboard/users', 
    icon: Users,
    roles: [UserRole.ADMIN]
  },
];
