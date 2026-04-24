"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { get, post } from "@/lib/services/apiService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Mail,
} from "lucide-react";

interface GmailStatus {
  connected: boolean;
  status: "connected" | "invalid" | "disconnected";
  email: string | null;
  last_error: string | null;
  updated_at: string | null;
}

export function GmailStatusCard() {
  const searchParams = useSearchParams();
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  // Handle redirect params after OAuth
  useEffect(() => {
    const emailSuccess = searchParams.get("email_success");
    const emailError = searchParams.get("email_error");
    if (emailSuccess) {
      toast.success("Gmail conectado correctamente");
      window.history.replaceState({}, "", "/settings");
    }
    if (emailError) {
      const messages: Record<string, string> = {
        no_refresh_token: "Google no devolvió el token. Intenta desconectar y volver a conectar.",
        missing_credentials: "Faltan credenciales de OAuth configuradas.",
        no_code: "No se recibió el código de autorización.",
        access_denied: "Acceso denegado por el usuario.",
      };
      toast.error(messages[emailError] ?? `Error al conectar Gmail: ${emailError}`);
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      const res = await get<GmailStatus>("user-email/status");
      if (res.ok && res.data) {
        setGmailStatus(res.data as GmailStatus);
      }
      setLoading(false);
    })();
  }, []);

  const handleConnect = () => {
    window.location.href = "/api/user-email/google";
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await post("user-email/google/disconnect", {});
      if (!res.ok) throw new Error(res.error);
      toast.success("Gmail desconectado");
      setGmailStatus((prev) =>
        prev ? { ...prev, connected: false, status: "disconnected", email: null } : prev
      );
    } catch {
      toast.error("Error al desconectar Gmail");
    } finally {
      setDisconnecting(false);
    }
  };

  const isConnected = gmailStatus?.connected;
  const isInvalid = gmailStatus?.status === "invalid";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" />
          Gmail personal
        </CardTitle>
        <CardDescription>
          Conecta tu cuenta de Gmail para enviar notificaciones de proyecto desde tu correo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Cargando estado...</span>
          </div>
        ) : (
          <>
            {/* Status row */}
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div className="flex items-center gap-3">
                {isConnected ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Conectado</p>
                      <p className="text-xs text-muted-foreground">{gmailStatus?.email}</p>
                    </div>
                  </>
                ) : isInvalid ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Token inválido</p>
                      <p className="text-xs text-muted-foreground">
                        Reconecta Gmail para continuar
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">No conectado</p>
                      <p className="text-xs text-muted-foreground">
                        Conecta Gmail para habilitar notificaciones
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isConnected && (
                  <Badge variant="secondary" className="text-xs">
                    Activo
                  </Badge>
                )}
                {isInvalid && (
                  <Badge variant="destructive" className="text-xs">
                    Reconexión requerida
                  </Badge>
                )}
                {isConnected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                  >
                    {disconnecting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Desconectar"
                    )}
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleConnect}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    {isInvalid ? "Reconectar Gmail" : "Conectar Gmail"}
                  </Button>
                )}
              </div>
            </div>

            {/* Last error */}
            {gmailStatus?.last_error && !isConnected && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-xs text-destructive font-medium">Último error</p>
                <p className="text-xs text-destructive/80 mt-0.5">{gmailStatus.last_error}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
