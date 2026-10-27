/**
 * Carga TODOS los archivos de entorno que existan, en orden. Una variable ya
 * definida (en el entorno o en un archivo anterior) no se sobrescribe, así que
 * el primero gana y los siguientes completan lo que falte: p. ej. `.env.local`
 * sin `DATABASE_URL` no impide leerla de `.env`.
 */
export function loadEnvFiles(files: string[] = [".env.local", ".env"]): void {
  for (const envFile of files) {
    try {
      process.loadEnvFile(envFile);
    } catch {
      // Archivo no encontrado — continúa con el siguiente
    }
  }
}
