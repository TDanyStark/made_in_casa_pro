'use server';

import { SignupFormSchema, FormState, UserType } from "@/lib/definitions";
import { createSession } from '@/lib/session'
import { deleteSession } from '@/lib/session'
import { redirect } from "next/navigation";
import bcrypt from "bcrypt";
import { getUserByEmail } from "../queries/users";


export async function login(state: FormState, formData: FormData) {
  // Extraer los datos del formulario para usarlos incluso si hay errores
  const submittedEmail = formData.get("email") as string;
  const submittedPassword = formData.get("password") as string;
  
  // Validate form fields
  const validatedFields = SignupFormSchema.safeParse({
    email: submittedEmail,
    password: submittedPassword,
  });

  // If any form fields are invalid, return early with submitted data
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      submittedData: {
        email: submittedEmail,
        password: submittedPassword,
      }
    };
  }

  // 2. Prepare data for insertion into database
  const { email, password } = validatedFields.data;
  // e.g. Hash the user's password before storing it
  // comprobar en la base de datos el email
  const res = await getUserByEmail(email);
  if (res.length === 0) {
    return {
      errors: { general: "Datos incorrectos"},
      submittedData: {
        email: email,
        password: password,
      }
    };
  }

  const user: UserType = res[0];
  
  // comprobar la contraseña
  if (!user.password) {
    return {
      errors: { general: "Datos incorrectos" },
      submittedData: {
        email: email,
        password: password,
      }
    };
  }


  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return {
      errors: { general: "Datos incorrectos" },
      submittedData: {
        email: email,
        password: password,
      }
    };
  }
  // 3. Create a session
  await createSession({name: user.name, email: user.email, id: user.id, rol_id: user.rol_id });
  // 4. Redirect to the dashboard
  redirect('/dashboard');
}

export async function logout() {
  await deleteSession()
  redirect('/')
}

