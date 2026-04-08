import { House, Folder, LayoutList, BookUser, LibraryBig, Users, Settings, CheckSquare, Receipt } from 'lucide-react';
import { LinksType, UserRole } from './definitions';
import { ADMIN_ONLY_ROLES, OPERATIONS_ROLES, PROJECT_EDIT_ROLES, PROJECT_VIEW_ROLES } from './role-groups';

export type NavSubLink = {
  name: string;
  route: string;
};

export const navSubLinks: Record<string, NavSubLink[]> = {
  '/clients': [
    { name: 'Marcas', route: '/brands' },
    { name: 'Gerentes', route: '/managers' },
  ],
};


export const links: LinksType[] = [
  { 
    name: 'Inicio', 
    route: '/dashboard', 
    icon: House,
    roles: PROJECT_VIEW_ROLES
  },
  {
    name: 'Proyectos',
    route: '/projects',
    icon: Folder,
    roles: PROJECT_VIEW_ROLES
  },
  {
    name: 'Mis Tareas',
    route: '/my-tasks',
    icon: CheckSquare,
    roles: PROJECT_VIEW_ROLES
  },
  {
    name: 'Mis Cotizaciones',
    route: '/my-quotes',
    icon: Receipt,
    roles: [UserRole.COLABORADOR]
  },
  { 
    name: 'Tareas', 
    route: '/tasks', 
    icon: LayoutList,
    roles: OPERATIONS_ROLES
  },
  { 
    name: 'Productos', 
    route: '/products', 
    icon: LibraryBig,
    roles: OPERATIONS_ROLES
  },
  { 
    name: 'Clientes', 
    route: '/clients', 
    icon: BookUser,
    roles: OPERATIONS_ROLES
  },
  { 
    name: 'Usuarios', 
    route: '/users', 
    icon: Users,
    roles: ADMIN_ONLY_ROLES
  },
  {
    name: 'Configuración',
    route: '/settings',
    icon: Settings,
    roles: ADMIN_ONLY_ROLES
  },
];

export const linksNotVisible: LinksType[] = [
  {
    route: '/my-quotes',
    roles: [UserRole.COLABORADOR]
  },
  {
    route: '/my-quotes/projects/[id]',
    roles: [UserRole.COLABORADOR]
  },
  {
    route: '/my-tasks',
    roles: PROJECT_VIEW_ROLES
  },
  {
    route: '/clients',
    roles: OPERATIONS_ROLES
  },
  {
    route: '/clients/[id]',
    roles: OPERATIONS_ROLES
  },
  {
    route: '/brands',
    roles: OPERATIONS_ROLES
  },
  {
    route: '/brands/[id]',
    roles: OPERATIONS_ROLES
  },
  {
    route: '/managers',
    roles: OPERATIONS_ROLES
  },
  {
    route: '/managers/[id]',
    roles: OPERATIONS_ROLES
  },
  {
    route: '/products/[id]',
    roles: OPERATIONS_ROLES
  },
  {
    route: '/products/create',
    roles: OPERATIONS_ROLES
  },
  {
    route: '/products/[id]/edit',
    roles: OPERATIONS_ROLES
  },
  {
    route: '/projects/[id]',
    roles: PROJECT_VIEW_ROLES
  },
  {
    route: '/projects/create',
    roles: PROJECT_EDIT_ROLES
  },
  {
    route: '/projects/[id]/edit',
    roles: PROJECT_EDIT_ROLES
  },
  {
    route: '/tasks/create',
    roles: OPERATIONS_ROLES
  },
  {
    route: '/tasks/[id]/edit',
    roles: OPERATIONS_ROLES
  },
  {
    route: '/users/[id]',
    roles: ADMIN_ONLY_ROLES
  },
]
