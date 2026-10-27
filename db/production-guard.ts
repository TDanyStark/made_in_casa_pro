/**
 * Los scripts de datos de ejemplo y de reset no deben tocar producción por
 * accidente. Con NODE_ENV=production salen con código 1, antes de conectar,
 * salvo que se confirme explícitamente con CONFIRM_PRODUCTION=1.
 */
export function assertProductionConfirmed(command: string): void {
  if (process.env.NODE_ENV === "production" && process.env.CONFIRM_PRODUCTION !== "1") {
    console.error(
      `✖  ${command} no se ejecuta en producción sin confirmación. Si de verdad quieres hacerlo, vuelve a ejecutarlo con CONFIRM_PRODUCTION=1.`
    );
    process.exit(1);
  }
}
