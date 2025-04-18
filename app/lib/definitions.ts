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
  email: string;
  password?: string;
  role: UserRole; // 1: comercial, 2: directivo, 3: colaborador, 4: admin
}

export enum UserRole {
  COMERCIAL = 1,
  DIRECTIVO = 2,
  COLABORADOR = 3,
  ADMIN = 4,
  NO_AUTHENTICADO = 0
}

export type ClientType = {
  id: number;
  name: string;
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
};

export type BrandType = {
  id?: number;
  manager_id: number;
  name: string;
};

export type ManagersParams ={
  clientId?: string;
  page?: string;
  search?: string;
  endpoint: string; // Nuevo parámetro para el endpoint
}