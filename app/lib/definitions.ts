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
    }
  | undefined

export type UserType = {
  id: number;
  name: string;
  email: string;
  password?: string;
  rol_id: UserRole; // 1: comercial, 2: directivo, 3: colaborador, 4: admin
}

export type ColaboradorType = UserType & {
  rol_id: UserRole.COLABORADOR;
  area_id: number | null;
  is_internal: boolean;
  hourly_rate: number | null;
}


export enum UserRole {
  COMERCIAL = 1,
  DIRECTIVO = 2,
  COLABORADOR = 3,
  ADMIN = 4,
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