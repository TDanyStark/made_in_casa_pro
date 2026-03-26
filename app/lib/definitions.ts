import { LucideProps } from 'lucide-react'
import { ForwardRefExoticComponent, RefAttributes } from 'react'
import { z } from 'zod'

export const SignupFormSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }).trim(),
  password: z
    .string()
    .min(6, { message: 'Be at least 8 characters long' })
})

export type FormState =
  | {
      errors?: {
        email?: string[]
        password?: string[]
        general?: string
      }
      message?: string
      submittedData?: {
        email?: string
        password?: string
      }
    }
  | undefined

export type UserType = {
  id: number;
  name: string;
  email: string;
  password?: string;
  rol_id: UserRole; // 1: admin, 2: directivo, 3: comercial, 4: colaborador
  must_change_password?: boolean;
  last_login?: string;
  is_active?: boolean;
  created_at?: string;
}

export type ColaboradorType = UserType & {
  rol_id: UserRole.COLABORADOR;
  area_id?: number;
  skills?: string[];
  is_internal: boolean;
  monthly_salary?: number;
}

export enum UserRole {
  ADMIN = 1,
  DIRECTIVO = 2,
  COMERCIAL = 3,
  COLABORADOR = 4,
  NO_AUTHENTICADO = 0
}

export type LinksType = {
  name?: string;
  route: string;
  icon?: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
  roles: UserRole[];
}

export type ClientType = {
  id: number;
  name: string;
  accept_business_units?: boolean;
  country?: CountryType;
}

export type CountryType = {
  id: number;
  name: string;
  flag: string;
}

export type ManagerType = {
  id?: number;
  client_id: number;
  name: string;
  email: string;
  phone: string;
  biography?: string;
  client_info?: ClientType;
};

export type BrandType = {
  id?: number;
  name: string;
  manager_id: number;
  business_unit_id?: number;
  manager?: ManagerType;
};

export type BrandsAndManagersType = {
  id: number;
  brand_name: string;
  manager_id: number;
  manager_name?: string;
};

export type ManagersParams ={
  clientId?: string;
  page?: string;
  search?: string;
  endpoint: string; // Nuevo parámetro para el endpoint
}

export interface BusinessUnitType {
  id: number;
  name: string;
}

export type AreaType = {
  id?: number;
  name: string;
};

export type SkillType = {
  id: number;
  name: string;
  selected?: boolean;
};

export type UserSkillType = {
  user_id: number;
  skill_id: number;
  skill_name: string;
};

// response API using apiService.ts
export type ApiResponse<T> ={
  data?: T;
  error?: string;
  status: number;
  ok: boolean;
};

export type ApiResponseWithPagination<T> = {
  data: T;
  pageCount: number;
  currentPage: number;
  total: number;
}

export type ProductCategoryType = {
  id: number;
  name: string;
};

export type ProductType = {
  id: number;
  name: string;
  description: string | null;
  category_id: number | null;
  category_name: string | null;
  is_active: number;
  created_at: string;
};

export type ProductTaskTemplateType = {
  id: number;
  product_id: number;
  title: string;
  description: string | null;
  area_id: number | null;
  area_name: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  order_index: number;
  created_at: string;
};

// ─── Projects module ────────────────────────────────────────────────────────

export type CampaignType = {
  id: number;
  name: string;
  created_at: string;
};

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export type ProjectType = {
  id: number;
  title: string;
  brand_id: number;
  brand_name: string;
  manager_id: number;
  manager_name: string;
  client_id: number;
  client_name: string;
  campaign_id: number | null;
  campaign_name: string | null;
  drive_folder_id: string | null;
  drive_folder_url: string | null;
  notes: string | null;
  status: ProjectStatus;
  progress: number;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  // aggregates (populated in list queries)
  product_count?: number;
  co_manager_count?: number;
};

export type ProjectDetailType = ProjectType & {
  co_managers: Array<{ id: number; name: string; email: string }>;
  products: ProjectProductType[];
};

export type ProjectProductStatus = 'pending' | 'in_progress' | 'completed';

export type ProjectProductType = {
  id: number;
  project_id: number;
  product_id: number;
  product_name: string;
  product_category_id: number | null;
  product_category_name: string | null;
  status: ProjectProductStatus;
  created_at: string;
  tasks?: ProjectTaskType[];
  task_total?: number;
  task_completed?: number;
};

export type ProjectTaskStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';

export type ProjectTaskType = {
  id: number;
  project_id: number;
  project_product_id: number;
  template_id: number | null;
  title: string;
  description: string | null;
  area_id: number | null;
  area_name: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  status: ProjectTaskStatus;
  order_index: number;
  created_at: string;
  updated_at: string;
};