import Link from "next/link";
import { MailCheck, MailWarning, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import MICLogo from "@/components/icons/MICLogo";
import { ModeToggle } from "@/components/ModeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { logout } from "@/lib/actions/auth";
import { UserRole } from "@/lib/definitions";
import { getUserEmailConnection, isGmailConnectionRequired } from "@/lib/queries/userEmailConnections";
import { getCurrentSession } from "@/lib/services/api-session";

type ConnectEmailPageProps = {
  searchParams?: Promise<{
    email_error?: string;
    email_success?: string;
    reconnect?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  access_denied: "No se concedieron los permisos necesarios para conectar Gmail.",
  missing_credentials: "Google OAuth no está configurado. Contacta a un administrador.",
  no_code: "Google no devolvió el código de autorización. Intenta conectar de nuevo.",
  no_email: "No pudimos leer el correo de la cuenta de Google conectada.",
  no_refresh_token: "Google no devolvió un token de actualización. Intenta conectar de nuevo y acepta todos los permisos.",
  unauthorized: "Tu sesión expiró. Inicia sesión nuevamente.",
};

export default async function ConnectEmailPage({ searchParams }: ConnectEmailPageProps) {
  const session = await getCurrentSession();
  if (!session?.id) redirect("/");

  if (!isGmailConnectionRequired()) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const isReconnect = params?.reconnect === "true";
  const connection = await getUserEmailConnection(session.id);
  const isConnected = connection?.status === "connected" && !!connection.refresh_token;

  // Only auto-redirect if user is connected AND not explicitly requesting a reconnect
  if (isConnected && !isReconnect) {
    redirect("/dashboard");
  }

  const rawError = params?.email_error ?? connection?.last_error ?? null;
  const errorMessage = rawError
    ? errorMessages[rawError] ?? "No pudimos conectar tu Gmail. Intenta reconectar la cuenta."
    : null;

  const statusLabel = isConnected
    ? "Gmail conectado"
    : connection?.status === "invalid"
      ? "Reconexión requerida"
      : "Gmail requerido";

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute right-4 top-4 z-20 md:right-8 md:top-8">
        <ModeToggle />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.16),transparent_35%)]" />
      <section className="relative z-10 flex min-h-screen items-center justify-center px-6 py-12">
        <Card className="w-full max-w-2xl border-primary/10 shadow-xl">
          <CardHeader className="space-y-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-mic-gradient p-3 shadow-lg">
              <MICLogo onlyIcon colorWhite />
            </div>
            <div className="space-y-2">
              <Badge className="mx-auto w-fit" variant={isConnected ? "secondary" : "destructive"}>
                {statusLabel}
              </Badge>
              <CardTitle className="text-2xl md:text-3xl">
                Conecta tu Gmail para continuar
              </CardTitle>
              <CardDescription className="mx-auto max-w-lg text-base">
                Made in Casa usa tu Gmail para enviar notificaciones desde tu correo y mantener el seguimiento de los hilos de cada proyecto.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {connection?.email ? (
              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
                {isConnected ? <MailCheck className="mt-0.5 text-emerald-600" /> : <MailWarning className="mt-0.5 text-destructive" />}
                <div>
                  <p className="font-medium">Cuenta detectada</p>
                  <p className="text-sm text-muted-foreground">{connection.email}</p>
                </div>
              </div>
            ) : null}

            {errorMessage ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <ShieldCheck className="mb-3 text-primary" />
                <h2 className="font-medium">Permiso mínimo</h2>
                <p className="mt-1 text-sm text-muted-foreground">Solo pedimos permiso para enviar correos desde Gmail.</p>
              </div>
              <div className="rounded-lg border p-4">
                <MailCheck className="mb-3 text-primary" />
                <h2 className="font-medium">Tracking claro</h2>
                <p className="mt-1 text-sm text-muted-foreground">Las tareas y respuestas quedan asociadas al correo correcto.</p>
              </div>
              <div className="rounded-lg border p-4">
                <MailWarning className="mb-3 text-primary" />
                <h2 className="font-medium">Reconexión segura</h2>
                <p className="mt-1 text-sm text-muted-foreground">Si Google revoca el acceso, te pediremos reconectar.</p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href="/api/user-email/google">
                {connection?.status === "invalid" ? "Reconectar Gmail" : "Conectar Gmail"}
              </Link>
            </Button>
            {session.rol_id === UserRole.ADMIN ? (
              <Button asChild variant="secondary" size="lg">
                <Link href="/settings">Configurar Google OAuth</Link>
              </Button>
            ) : null}
            <form action={logout}>
              <Button type="submit" variant="outline" size="lg">
                Cerrar sesión
              </Button>
            </form>
          </CardFooter>
        </Card>
      </section>
    </main>
  );
}
