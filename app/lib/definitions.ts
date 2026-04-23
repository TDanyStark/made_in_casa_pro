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
  rol_id: UserRole; // 1: admin, 2: directivo, 3: comercial, 4: colaborador, 5: financiero
  is_internal?: boolean | null; // relevant for colaboradores externos
  pending_tasks_count?: number | null;
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
  FINANCIERO = 5,
  NO_AUTHENTICADO = 0
}

export type LinksType = {
  name?: string;
  route: string;
  icon?: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
  roles: readonly UserRole[];
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

export type TaskType = 'execution' | 'validation';
export type TaskFlag = 'new' | 'correction' | 'adjustment';

export type TemplateQuoter = {
  user_id: number;
  user_name: string;
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
  assigned_user_rol_id: number | null;
  order_index: number;
  task_type: TaskType;
  requires_quote: number; // 0 | 1
  assign_to_commercial: number; // 0 | 1
  created_at: string;
  /** Pre-configured external quoters (only present when requires_quote=1) */
  quoters?: TemplateQuoter[];
};

// ─── Projects module ────────────────────────────────────────────────────────

export type CampaignType = {
  id: number;
  name: string;
  client_id: number | null;
  client_name?: string;
  created_at: string;
};

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived' | 'in_adjustments';

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
  product_id: number | null;
  product_name: string | null;
  product_category_name: string | null;
  drive_folder_id: string | null;
  drive_folder_url: string | null;
  notes: string | null;
  ideal_delivery_at: string | null;
  oc: string | null;
  billing_closed_at: string | null;
  status: ProjectStatus;
  progress: number;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  // aggregates (populated in list queries)
  co_manager_count?: number;
};

export type ProjectDetailType = ProjectType & {
  co_managers: Array<{ id: number; name: string; email: string }>;
};

export type ProjectAdjustmentType = {
  id: number;
  project_id: number;
  version_number: number;
  drive_folder_id: string | null;
  drive_folder_url: string | null;
  status: 'active' | 'completed';
  notes: string | null;
  created_at: string;
  completed_at?: string;
};

export type ProjectTaskStatus = 'not_started' | 'waiting' | 'in_progress' | 'completed' | 'blocked';

export type ProjectTaskType = {
  id: number;
  project_id: number;
  template_id: number | null;
  title: string;
  description: string | null;
  area_id: number | null;
  area_name: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  assigned_user_rol_id: number | null;
  assigned_user_is_internal?: number | null; // 0 | 1 | null
  status: ProjectTaskStatus;
  task_type: TaskType;
  task_flag: TaskFlag;
  adjustment_id: number | null;
  requires_quote: number; // 0 | 1
  assign_to_commercial: number; // 0 | 1
  order_index: number;
  created_at: string;
  updated_at: string;
  assigned_at?: string;
  completed_at?: string;
  quoter_ids?: number[];
  // completion fields
  delivery_url: string | null;
  delivery_notes?: string | null;
  completion_cost: number | null;
  progress_percent: number;
  progress_minutes: number;
  // aggregates
  quote_count?: number;
  pending_quote_count?: number;
};

export type TaskTransitionType = {
  id: number;
  task_id: number;
  project_id: number;
  from_status: string | null;
  to_status: string;
  from_flag: string | null;
  to_flag: string | null;
  moved_by: number | null;
  moved_by_name: string | null;
  notes: string | null;
  transitioned_at: string;
};

export type TaskCommandCenterFilters = {
  page?: number;
  limit?: number;
  creatorUserId?: number;
  areaId?: number;
  assignedUserId?: number;
  statuses?: ProjectTaskStatus[];
  taskType?: TaskType;
  taskFlag?: TaskFlag;
  assignedFrom?: Date;
  assignedTo?: Date;
  completedFrom?: Date;
  completedTo?: Date;
};

export type MyTaskRowPaginated = {
  // Core task
  id: number;
  title: string;
  description: string | null;
  project_id: number;
  area_id: number | null;
  area_name: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  assigned_user_rol_id: number | null;
  assigned_user_is_internal?: number | null; // 0 | 1 | null
  status: ProjectTaskStatus;
  task_type: TaskType;
  task_flag: TaskFlag;
  adjustment_id: number | null;
  version_number: number;
  requires_quote: number;
  assign_to_commercial: number;
  order_index: number;
  assigned_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  quoter_ids?: number[];
  quote_count?: number;
  pending_quote_count?: number;
  // completion fields
  delivery_url: string | null;
  completion_cost: number | null;
  progress_percent: number;
  progress_minutes: number;
  // Joined fields
  project_title: string;
  product_name: string | null;
  brand_id: number | null;
  brand_name: string | null;
  creator_user_id: number | null;
  creator_user_name: string | null;
};

export type MyTasksFilters = {
  page?: number;
  limit?: number;
  statuses?: ProjectTaskStatus[];
  brandId?: number;
  creatorUserId?: number;
  assignedFrom?: Date;
  assignedTo?: Date;
  q?: string;
};

export type TaskCommandCenterRow = {
  id: number;
  title: string;
  project_id: number;
  project_title: string;
  product_name: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  assigned_user_is_internal: boolean | null;
  task_flag: TaskFlag;
  task_type: TaskType;
  status: ProjectTaskStatus;
  requires_quote: number; // 0 | 1
  assigned_at: string | null;
  completed_at: string | null;
};

export type QuoteStatus = 'pending' | 'accepted' | 'rejected';

export type TaskQuoteType = {
  id: number;
  task_id: number;
  task_title?: string;
  project_id?: number;
  user_id: number;
  user_name: string;
  price: number | null;
  delivery_days: number | null;
  delivery_hours: number | null;
  delivery_minutes: number | null;
  notes: string | null;
  status: QuoteStatus;
  created_at: string;
  updated_at: string;
};

export const QuoteSubmissionSchema = z.object({
  price: z.coerce.number().positive(),
  delivery_days: z.coerce.number().int().nonnegative().optional().nullable(),
  delivery_hours: z.coerce.number().int().nonnegative().optional().nullable(),
  delivery_minutes: z.coerce.number().int().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine((data) => {
  const total = (data.delivery_days || 0) + (data.delivery_hours || 0) + (data.delivery_minutes || 0);
  return total > 0;
}, {
  message: "At least one time unit (days, hours, or minutes) must be provided and positive.",
  path: ["delivery_days"],
});

export type TaskQuoteInvitationType = {
  id: number;
  task_id: number;
  task_title?: string;
  project_id?: number;
  project_name?: string;
  user_id: number;
  user_name: string;
  invited_by: number | null;
  invited_by_name: string | null;
  invited_at: string;
  // joined from task_quotes
  quote_status?: QuoteStatus | null;
};
