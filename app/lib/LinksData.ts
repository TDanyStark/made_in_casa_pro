import {
  RectangleStackIcon,
  HomeIcon,
  DocumentDuplicateIcon,
  UserGroupIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';


export const links = [
  { 
    name: 'Inicio', 
    href: '/dashboard', 
    icon: HomeIcon,
    roles: ["admin", "comercial", "directivo", "colaborador"]
  },
  {
    name: 'Proyectos',
    href: '/dashboard/projects',
    icon: DocumentDuplicateIcon,
    roles: ["admin", "comercial", "directivo"]
  },
  { 
    name: 'Tareas', 
    href: '/dashboard/tasks', 
    icon: RectangleStackIcon,
    roles: ["admin", "comercial", "directivo", "colaborador"]
  },
  { 
    name: 'Clientes', 
    href: '/dashboard/clients', 
    icon: UserGroupIcon,
    roles: ["admin", "comercial", "directivo"]
  },
  { 
    name: 'Productos', 
    href: '/dashboard/products', 
    icon: Squares2X2Icon,
    roles: ["admin", "comercial", "directivo"]
  },
];
