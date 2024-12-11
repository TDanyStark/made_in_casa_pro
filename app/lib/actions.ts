// app/actions.ts
"use server";

import { connectDB } from "./neon";
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

export async function getData() {
    const sql = await connectDB(); 
    const data = await sql`CREATE TABLE IF NOT EXISTS test (id SERIAL PRIMARY KEY, name TEXT)`;
    return data;
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
  ) {
    try {
      await signIn('credentials', formData);
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.type) {
          case 'CredentialsSignin':
            return 'Invalid credentials.';
          default:
            return 'Something went wrong.';
        }
      }
      throw error;
    }
  }