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
    href: '/projects',
    icon: Folder,
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  { 
    name: 'Tareas', 
    href: '/tasks', 
    icon: LayoutList,
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  { 
    name: 'Productos', 
    href: '/products', 
    icon: LibraryBig,
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  { 
    name: 'Clientes', 
    href: '/clients', 
    icon: BookUser,
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  { 
    name: 'Usuarios', 
    href: '/users', 
    icon: Users,
    roles: [UserRole.ADMIN]
  },
];

export const linksNotVisible = [
  {
    route: '/clients/create',
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  {
    route: '/clients/[id]/edit',
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  {
    route: '/products/create',
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  {
    route: '/products/[id]/edit',
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  {
    route: '/projects/create',
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  {
    route: '/projects/[id]/edit',
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  {
    route: '/tasks/create',
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  {
    route: '/tasks/[id]/edit',
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  {
    route: '/users/create',
    roles: [UserRole.ADMIN]
  },
  {
    route: '/users/[id]/edit',
    roles: [UserRole.ADMIN]
  },
]