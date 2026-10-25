'use server';

import { SignupFormSchema, FormState, UserType } from "@/lib/definitions";
import { createSession } from '@/lib/session'
import { deleteSession } from '@/lib/session'
import { redirect } from "next/navigation";
import bcrypt from "bcrypt";
import { getUserByEmail } from "../queries/users";
import { getUserConnectedEmailStatus } from "../queries/userEmailConnections";
import { getSafeRedirectPath, LOGIN_REDIRECT_PARAM } from "../utils/safe-redirect";


export async function login(state: FormState, formData: FormData): Promise<FormState> {
  // Extraer los datos del formulario. Solo el email vuelve al cliente:
  // la contraseña nunca se devuelve en el estado de la acción.
  const submittedEmail = formData.get("email") as string;
  const submittedPassword = formData.get("password") as string;

  // Validate form fields
  const validatedFields = SignupFormSchema.safeParse({
    email: submittedEmail,
    password: submittedPassword,
  });

  // If any form fields are invalid, return early with the submitted email
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      submittedData: { email: submittedEmail },
    };
  }

  const { email, password } = validatedFields.data;
  const invalidCredentials = {
    errors: { general: "Datos incorrectos" },
    submittedData: { email },
  };

  // comprobar en la base de datos el email
  const res = await getUserByEmail(email);
  if (res.length === 0) return invalidCredentials;

  const user: UserType = res[0];

  // comprobar la contraseña
  if (!user.password) return invalidCredentials;

  const match = await bcrypt.compare(password, user.password);
  // Un usuario desactivado recibe el mismo mensaje genérico (no revela que existe).
  if (!match || user.is_active === false) return invalidCredentials;

  // 3. Create a session
  await createSession({name: user.name, email: user.email, id: user.id, rol_id: user.rol_id });

  // Volver a la ruta que el usuario intentó abrir antes del login (p. ej. link de un correo).
  // En ese caso se omite /connect-email para no desviarlo de su destino.
  const returnTo = getSafeRedirectPath(formData.get(LOGIN_REDIRECT_PARAM) as string | null);
  if (returnTo) {
    redirect(returnTo);
  }

  const hasConnectedGmail = await getUserConnectedEmailStatus(user.id);

  if (!hasConnectedGmail) {
    redirect('/connect-email');
  }

  // 4. Redirect to the dashboard
  redirect('/dashboard');
}

export async function logout() {
  await deleteSession()
  redirect('/')
}

