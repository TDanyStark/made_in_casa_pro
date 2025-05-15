import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function hashPassword(password: string): Promise<string> {
  // En un entorno de producción, deberías usar una biblioteca como bcrypt
  // Este es un hash simple para propósitos de demostración
  // Por ejemplo: const hashed = await bcrypt.hash(password, 10);
  
  // Implementación simple (NO USAR EN PRODUCCIÓN)
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt_secreto');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  // En producción con bcrypt sería: return await bcrypt.compare(plainPassword, hashedPassword);
  
  // Implementación simple que corresponde con hashPassword (NO USAR EN PRODUCCIÓN)
  const hashedInput = await hashPassword(plainPassword);
  return hashedInput === hashedPassword;
}
