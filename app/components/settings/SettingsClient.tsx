"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { get, patch } from "@/lib/services/apiService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { HardDrive, CheckCircle2, XCircle, ExternalLink, Loader2, Settings, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SettingsData {
  google_oauth_client_id: string | null;
  google_oauth_client_secret: string | null; // "***configured***" or null
  google_oauth_connected_email: string | null;
  google_oauth_connected: boolean;
  daily_report_time: string;
}

interface CurrentUserData {
  id: number;
  rol_id: number;
}

const schema = z.object({
  google_oauth_client_id: z.string().min(1, "Requerido"),
  google_oauth_client_secret: z.string().min(1, "Requerido"),
});

type FormValues = z.infer<typeof schema>;

export function SettingsClient() {
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingReportTime, setSavingReportTime] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<number | null>(null);
  const [dailyReportTime, setDailyReportTime] = useState("18:00");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      google_oauth_client_id: "",
      google_oauth_client_secret: "",
    },
  });

  // Handle redirect back from Google OAuth
  useEffect(() => {
    const success = searchParams.get("google_success");
    const error = searchParams.get("google_error");
    if (success) {
      toast.success("Google Drive conectado correctamente");
      // Clean URL
      window.history.replaceState({}, "", "/settings");
    }
    if (error) {
      const messages: Record<string, string> = {
        no_refresh_token: "Google no devolvió el token. Intenta desconectar y volver a conectar.",
        missing_credentials: "Guarda el Client ID y Client Secret primero.",
        no_code: "No se recibió el código de autorización.",
        access_denied: "Acceso denegado por el usuario.",
      };
      toast.error(messages[error] ?? `Error: ${error}`);
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams]);

  // Load current settings
  useEffect(() => {
    (async () => {
      const res = await get<SettingsData>("settings");
      if (res.ok && res.data) {
        const data = res.data as unknown as SettingsData;
        setSettings(data);
        setDailyReportTime(data.daily_report_time ?? "18:00");
        form.reset({
          google_oauth_client_id: data.google_oauth_client_id ?? "",
          google_oauth_client_secret: "",
        });
      }

      const meRes = await get<CurrentUserData>("me");
      if (meRes.ok && meRes.data) {
        setCurrentUserRole((meRes.data as CurrentUserData).rol_id);
      }

      setLoading(false);
    })();
  }, [form]);

  const onSave = async (values: FormValues) => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        google_oauth_client_id: values.google_oauth_client_id,
      };
      // Only send secret if user typed a new one (not the placeholder)
      if (values.google_oauth_client_secret) {
        payload.google_oauth_client_secret = values.google_oauth_client_secret;
      }

      const res = await patch("settings", payload);
      if (!res.ok) throw new Error(res.error);
      toast.success("Configuración guardada");
      // Refresh settings
      const refreshed = await get<SettingsData>("settings");
      if (refreshed.ok && refreshed.data) {
        setSettings(refreshed.data as unknown as SettingsData);
      }
    } catch {
      toast.error("Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = () => {
    setConnecting(true);
    // Redirect to the OAuth flow — the server handles the redirect to Google
    window.location.href = "/api/settings/google";
  };

  const handleDisconnect = async () => {
    try {
      const res = await patch("settings", {
        google_oauth_refresh_token: null,
        google_oauth_connected_email: null,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Cuenta de Google desconectada");
      setSettings((prev) => prev ? { ...prev, google_oauth_connected: false, google_oauth_connected_email: null } : prev);
    } catch {
      toast.error("Error al desconectar");
    }
  };

  const handleSaveDailyReportTime = async () => {
    setSavingReportTime(true);
    try {
      const res = await patch("settings", {
        daily_report_time: dailyReportTime,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Hora de reporte guardada");
      setSettings((prev) => (prev ? { ...prev, daily_report_time: dailyReportTime } : prev));
    } catch {
      toast.error("Error al guardar la hora de reporte");
    } finally {
      setSavingReportTime(false);
    }
  };

  const isAdmin = currentUserRole === 1;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando configuración...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Google Drive OAuth */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4" />
            Google Drive
          </CardTitle>
          <CardDescription>
            Conecta la cuenta de Google Drive donde se crearán las carpetas de los proyectos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Connection status */}
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div className="flex items-center gap-3">
              {settings?.google_oauth_connected ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Conectado</p>
                    <p className="text-xs text-muted-foreground">
                      {settings.google_oauth_connected_email}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">No conectado</p>
                    <p className="text-xs text-muted-foreground">
                      Configura las credenciales y conecta la cuenta
                    </p>
                  </div>
                </>
              )}
            </div>
            {settings?.google_oauth_connected ? (
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                Desconectar
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={connecting || !settings?.google_oauth_client_id || settings.google_oauth_client_secret === null}
              >
                {connecting ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Conectando...</>
                ) : (
                  <><ExternalLink className="h-3.5 w-3.5 mr-1.5" />Conectar con Google</>
                )}
              </Button>
            )}
          </div>

          <hr className="border-border" />

          {/* OAuth credentials form */}
          <div className="space-y-1">
            <p className="text-sm font-medium flex items-center gap-2">
              <Settings className="h-3.5 w-3.5" />
              Credenciales OAuth 2.0
            </p>
            <p className="text-xs text-muted-foreground">
              Obtén estas credenciales en{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Google Cloud Console
              </a>
              {" "}→ Credenciales → OAuth 2.0 Client ID.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
              <FormField
                control={form.control}
                name="google_oauth_client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="google_oauth_client_secret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Client Secret
                      {settings?.google_oauth_client_secret === "***configured***" && (
                        <Badge variant="secondary" className="ml-2 text-xs font-normal">
                          Configurado
                        </Badge>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={
                          settings?.google_oauth_client_secret === "***configured***"
                            ? "Dejar vacío para mantener el actual"
                            : "GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
                  ) : (
                    "Guardar credenciales"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Reportes
            </CardTitle>
            <CardDescription>
              Define la hora en la que los colaboradores verán el recordatorio para reportar su avance diario.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="daily-report-time">Hora de notificación diaria</Label>
              <Input
                id="daily-report-time"
                type="time"
                value={dailyReportTime}
                onChange={(e) => setDailyReportTime(e.target.value || "18:00")}
              />
              <p className="text-xs text-muted-foreground">
                Si no hay valor guardado, la aplicación usará 18:00 por defecto.
              </p>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={handleSaveDailyReportTime} disabled={savingReportTime}>
                {savingReportTime ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
                ) : (
                  "Guardar hora de reporte"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
