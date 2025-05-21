import { House, Folder, LayoutList, BookUser, LibraryBig, Users } from 'lucide-react';
import { LinksType, UserRole } from './definitions';


export const links: LinksType[] = [
  { 
    name: 'Inicio', 
    route: '/dashboard', 
    icon: House,
    roles: [UserRole.COMERCIAL, UserRole.DIRECTIVO, UserRole.COLABORADOR, UserRole.ADMIN]
  },
  {
    name: 'Proyectos',
    route: '/projects',
    icon: Folder,
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  { 
    name: 'Tareas', 
    route: '/tasks', 
    icon: LayoutList,
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  { 
    name: 'Productos', 
    route: '/products', 
    icon: LibraryBig,
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  { 
    name: 'Clientes', 
    route: '/clients', 
    icon: BookUser,
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  { 
    name: 'Usuarios', 
    route: '/users', 
    icon: Users,
    roles: [UserRole.ADMIN]
  },
];

export const linksNotVisible: LinksType[] = [
  {
    route: '/clients',
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  {
    route: '/clients/[id]',
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  {
    route: '/brands',
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  {
    route: '/brands/[id]',
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  {
    route: '/managers',
    roles: [UserRole.ADMIN, UserRole.COMERCIAL, UserRole.DIRECTIVO]
  },
  {
    route: '/managers/[id]',
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
    route: '/users/[id]',
    roles: [UserRole.ADMIN]
  },
]