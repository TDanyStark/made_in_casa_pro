'use server';

import { SignupFormSchema, FormState } from "@/lib/definitions";
import { createSession } from '@/lib/session'
import { deleteSession } from '@/lib/session'
import { redirect } from "next/navigation";


export async function login(state: FormState, formData: FormData) {
  // Validate form fields
  const validatedFields = SignupFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  // If any form fields are invalid, return early
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  // 2. Prepare data for insertion into database
  const { email, password } = validatedFields.data;
  // e.g. Hash the user's password before storing it
  // validar manualmente hellen.reyes@market-support.com 123456

  if (email === 'hellen.reyes@market-support.com' && password === '123456') {
    // 3. Create user session
    await createSession("1")
    // 4. Redirect user
    redirect('/dashboard')
  } else {
    return {
      message: "Invalid email or password.",
    };
  }

}

export async function logout() {
  deleteSession()
  redirect('/')
}

